/// Log Work Screen - Enhanced with Full Scenario
/// 
/// Flow: Customer → Project → Supervisor → Service → Location → Time → Allowances → Notes
/// All data fetched from API - no static/mock data.

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/network/api_client.dart';

class LogWorkScreen extends StatefulWidget {
  const LogWorkScreen({super.key});

  @override
  State<LogWorkScreen> createState() => _LogWorkScreenState();
}

class _LogWorkScreenState extends State<LogWorkScreen> {
  final ApiClient _api = ApiClient();
  
  // Date selection
  DateTime _selectedDate = DateTime.now();
  int _selectedDayIndex = DateTime.now().weekday - 1;
  
  // Form fields
  String? _selectedCustomerId;
  String? _selectedSupervisorId;
  String? _selectedProjectId;
  String? _selectedServiceId;
  String _locationOverride = '';
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 16, minute: 0);
  
  // Multiple breaks support
  List<_BreakEntry> _breaks = [];
  
  final _notesController = TextEditingController();
  final _locationController = TextEditingController();
  final List<File> _photos = [];
  
  // Allowances
  List<_AllowanceEntry> _allowanceEntries = [];
  
  // Data from API
  List<dynamic> _assignments = []; // Employee's project assignments
  List<dynamic> _customers = [];
  List<dynamic> _supervisors = [];
  List<dynamic> _projects = []; // Filtered by customer from assignments
  List<dynamic> _services = [];
  List<dynamic> _allowanceTypes = [];
  List<dynamic> _dayWorklogs = [];  // Submitted worklogs for selected day
  
  // Loading states
  bool _isLoading = true;
  bool _loadingProjects = false;
  bool _isSubmitting = false;
  bool _loadingDayWorklogs = false;
  
  // Employee permissions (from profile)
  bool _canAddAllowances = false;
  
  @override
  void initState() {
    super.initState();
    _locationController.addListener(_onLocationChanged);
    _loadInitialData();
  }

  void _onLocationChanged() {
    // Trigger rebuild when location text changes to update button state
    setState(() {});
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      // Load all customers available for worklog
      final customersResponse = await _api.get('/customers/worklog-customers/');
      if (customersResponse != null) {
        _customers = customersResponse is List ? customersResponse : (customersResponse['results'] ?? []);
      }
      
      // Load allowance types
      final allowanceResponse = await _api.get('/employees/allowance-types/');
      if (allowanceResponse != null) {
        _allowanceTypes = allowanceResponse is List ? allowanceResponse : (allowanceResponse['results'] ?? []);
      }
      
      // Check if employee can add allowances (from profile)
      final profileResponse = await _api.get('/employees/me/');
      if (profileResponse != null) {
        _canAddAllowances = profileResponse['can_add_allowances'] ?? false;
      }
      
      // Load worklogs for selected day
      await _loadDayWorklogs();
      
    } catch (e) {
      debugPrint('Failed to load initial data: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadDayWorklogs() async {
    setState(() => _loadingDayWorklogs = true);
    try {
      final dateStr = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
      final response = await _api.get('/worklogs/?work_date=$dateStr');
      if (response != null) {
        _dayWorklogs = response is List ? response : (response['results'] ?? []);
      }
    } catch (e) {
      debugPrint('Failed to load day worklogs: $e');
    } finally {
      setState(() => _loadingDayWorklogs = false);
    }
  }

  Future<void> _onCustomerSelected(String? customerId) async {
    setState(() {
      _selectedCustomerId = customerId;
      _selectedSupervisorId = null;
      _selectedProjectId = null;
      _selectedServiceId = null;
      _supervisors = [];
      _projects = [];
      _services = [];
      _locationController.clear();
    });
    
    if (customerId == null) return;
    
    setState(() => _loadingProjects = true);
    try {
      // Load supervisors (outfolders) for this customer
      final outfoldersResponse = await _api.get('/customers/worklog-customers/$customerId/outfolders/');
      if (outfoldersResponse != null) {
        _supervisors = outfoldersResponse is List ? outfoldersResponse : (outfoldersResponse['results'] ?? []);
      }
      
      // Load projects for this customer
      final projectsResponse = await _api.get('/customers/worklog-customers/$customerId/projects/');
      if (projectsResponse != null) {
        _projects = projectsResponse is List ? projectsResponse : (projectsResponse['results'] ?? []);
      }
      
      // Load services for this customer
      final servicesResponse = await _api.get('/customers/worklog-customers/$customerId/services/');
      if (servicesResponse != null) {
        _services = servicesResponse is List ? servicesResponse : (servicesResponse['results'] ?? []);
      }
      
    } catch (e) {
      debugPrint('Failed to load customer data: $e');
    } finally {
      setState(() => _loadingProjects = false);
    }
  }

  void _onProjectSelected(String? projectId) {
    setState(() {
      _selectedProjectId = projectId;
    });
    
    // Auto-fill location from project
    if (projectId != null) {
      final project = _projects.firstWhere((p) => p['id'].toString() == projectId, orElse: () => null);
      if (project != null) {
        final address = project['location_address']?.toString() ?? '';
        final city = project['location_city']?.toString() ?? '';
        final locationName = project['location']?.toString() ?? '';
        
        String locationText = '';
        if (address.isNotEmpty || city.isNotEmpty) {
          // Use detailed address if available
          final parts = <String>[];
          if (address.isNotEmpty) parts.add(address);
          if (city.isNotEmpty) parts.add(city);
          locationText = parts.join(', ');
        } else if (locationName.isNotEmpty) {
          // Fallback to location name
          locationText = locationName;
        }
        
        if (locationText.isNotEmpty) {
          setState(() {
            _locationController.text = locationText;
          });
        }
      }
    }
  }

  void _showMapsAppChooser(String address) {
    final encodedAddress = Uri.encodeComponent(address);
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Open in Maps',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              address,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
            ),
            const SizedBox(height: 20),
            
            // Google Maps
            _buildMapOption(
              icon: Icons.map,
              iconColor: Colors.red,
              title: 'Google Maps',
              onTap: () async {
                Navigator.pop(context);
                final url = 'https://www.google.com/maps/search/?api=1&query=$encodedAddress';
                if (await canLaunchUrl(Uri.parse(url))) {
                  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                }
              },
            ),
            
            // Apple Maps (iOS only)
            if (Platform.isIOS) ...[
              const SizedBox(height: 12),
              _buildMapOption(
                icon: Icons.map_outlined,
                iconColor: Colors.blue,
                title: 'Apple Maps',
                onTap: () async {
                  Navigator.pop(context);
                  final url = 'https://maps.apple.com/?q=$encodedAddress';
                  if (await canLaunchUrl(Uri.parse(url))) {
                    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                  }
                },
              ),
            ],
            
            // Waze
            const SizedBox(height: 12),
            _buildMapOption(
              icon: Icons.navigation,
              iconColor: Colors.cyan,
              title: 'Waze',
              onTap: () async {
                Navigator.pop(context);
                final url = 'https://waze.com/ul?q=$encodedAddress&navigate=yes';
                if (await canLaunchUrl(Uri.parse(url))) {
                  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                }
              },
            ),
            
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildMapOption({
    required IconData icon,
    required Color iconColor,
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
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

  double get _hoursWorked {
    final start = _startTime.hour * 60 + _startTime.minute;
    int end = _endTime.hour * 60 + _endTime.minute;
    if (end < start) end += 24 * 60; // Overnight work
    
    // Calculate total break minutes from all breaks
    final breakMinutes = _breaks.fold<int>(0, (sum, brk) => sum + brk.durationMinutes);
    
    return (end - start - breakMinutes) / 60;
  }

  Future<void> _submitWorkLog() async {
    if (_selectedProjectId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a project')),
      );
      return;
    }
    
    setState(() => _isSubmitting = true);
    
    try {
      // Calculate total break minutes from all breaks
      final totalBreakMinutes = _breaks.fold<int>(0, (sum, brk) => sum + brk.durationMinutes);
      
      // Prepare breaks array for API
      final breaksData = _breaks
          .where((brk) => brk.start != null && brk.end != null)
          .map((brk) => brk.toJson())
          .toList();
      
      // Prepare allowances
      final allowances = _allowanceEntries
          .where((e) => e.hours > 0 && (e.selectedTypeId != null || e.customName.isNotEmpty))
          .map((e) => {
            'allowance_type': e.selectedTypeId,
            'custom_allowance_name': e.customName,
            'hours': e.hours,
          })
          .toList();
      
      final payload = {
        'project': _selectedProjectId,
        'supervisor': _selectedSupervisorId,
        'service': _selectedServiceId,
        'location_override': _locationController.text,
        'work_date': '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}',
        'start_time': '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}:00',
        'end_time': '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}:00',
        'break_duration_minutes': totalBreakMinutes,
        'breaks': breaksData,  // Multiple breaks array
        'notes': _notesController.text,
        'allowances': allowances,
      };
      
      await _api.post('/worklogs/', body: payload);
      
      if (mounted) {
        // Reload day worklogs to show new entry
        await _loadDayWorklogs();
        
        // Clear form for new entry
        setState(() {
          _selectedCustomerId = null;
          _selectedProjectId = null;
          _selectedSupervisorId = null;
          _selectedServiceId = null;
          _breaks.clear();
          _notesController.clear();
          _locationController.clear();
          _photos.clear();
          _allowanceEntries.clear();
          _supervisors = [];
          _projects = [];
          _services = [];
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Work log submitted! You can add another entry.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to submit: $e')),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  DateTime get _weekStart {
    return _selectedDate.subtract(Duration(days: _selectedDate.weekday - 1));
  }

  /// Calculate ISO 8601 week number (weeks start on Monday)
  int get _weekNumber {
    // Find the Thursday of the current week (ISO weeks are defined by their Thursday)
    final thursday = _selectedDate.add(Duration(days: DateTime.thursday - _selectedDate.weekday));
    // Find the first Thursday of the year
    final firstDayOfYear = DateTime(thursday.year, 1, 1);
    int firstThursday = 1 + (DateTime.thursday - firstDayOfYear.weekday + 7) % 7;
    final firstThursdayDate = DateTime(thursday.year, 1, firstThursday);
    // Calculate week number
    final weekNumber = ((thursday.difference(firstThursdayDate).inDays) / 7).floor() + 1;
    return weekNumber;
  }
  
  /// Get the year for the ISO week (may be different from calendar year at year boundaries)
  int get _weekYear {
    final thursday = _selectedDate.add(Duration(days: DateTime.thursday - _selectedDate.weekday));
    return thursday.year;
  }

  void _previousWeek() {
    setState(() => _selectedDate = _selectedDate.subtract(const Duration(days: 7)));
    _loadDayWorklogs();
  }
  
  void _nextWeek() {
    setState(() => _selectedDate = _selectedDate.add(const Duration(days: 7)));
    _loadDayWorklogs();
  }
  
  void _selectDay(int index) {
    setState(() {
      _selectedDayIndex = index;
      _selectedDate = _weekStart.add(Duration(days: index));
    });
    _loadDayWorklogs();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _buildWeekHeader(),
          _buildDaySelector(),
          _buildDateBanner(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Submitted worklogs for this day
                  _buildDayWorklogsSection(),
                  const SizedBox(height: 16),
                  
                  // 1. Customer Selection
                  _buildSearchableDropdown(
                    label: 'Customer',
                    hint: 'Select customer...',
                    selectedValue: _selectedCustomerId,
                    items: _customers,
                    valueKey: 'id',
                    displayKey: 'company_name',
                    onChanged: (v) => _onCustomerSelected(v),
                  ),
                  const SizedBox(height: 16),
                  
                  // 2. Project Selection (only if customer selected)
                  if (_selectedCustomerId != null) ...[
                    _buildSearchableDropdown(
                      label: 'Project',
                      hint: _loadingProjects ? 'Loading...' : 'Select project...',
                      selectedValue: _selectedProjectId,
                      items: _projects,
                      valueKey: 'id',
                      displayKey: 'name',
                      subtitleKey: 'location',
                      onChanged: (v) => _onProjectSelected(v),
                    ),
                    const SizedBox(height: 16),
                  ],
                  
                  // 3. Supervisor Selection (only if customer selected)
                  if (_selectedCustomerId != null) ...[
                    _buildSearchableDropdown(
                      label: 'Supervisor',
                      hint: _loadingProjects ? 'Loading...' : 'Select supervisor...',
                      selectedValue: _selectedSupervisorId,
                      items: _supervisors,
                      valueKey: 'id',
                      displayKey: 'full_name',
                      onChanged: (v) => setState(() => _selectedSupervisorId = v),
                      optional: true,
                    ),
                    const SizedBox(height: 16),
                  ],
                  
                  // 4. Service Selection (only if customer selected)
                  if (_selectedCustomerId != null && _services.isNotEmpty) ...[
                    _buildSearchableDropdown(
                      label: 'Service Type',
                      hint: 'Select service type...',
                      selectedValue: _selectedServiceId,
                      items: _services,
                      valueKey: 'id',
                      displayKey: 'name',
                      onChanged: (v) => setState(() => _selectedServiceId = v),
                      optional: true,
                    ),
                    const SizedBox(height: 16),
                  ],
                  
                  // 5. Location (auto from project or manual)
                  if (_selectedProjectId != null) ...[
                    _buildTextField(
                      label: 'Location',
                      controller: _locationController,
                      hint: 'Location address...',
                      icon: Icons.location_on,
                    ),
                    const SizedBox(height: 8),
                    // View in Maps button
                    GestureDetector(
                      onTap: _locationController.text.isNotEmpty 
                          ? () => _showMapsAppChooser(_locationController.text)
                          : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: _locationController.text.isNotEmpty 
                              ? Colors.blue.shade50 
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _locationController.text.isNotEmpty 
                                ? Colors.blue.shade200 
                                : Colors.grey.shade300,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.map_outlined, 
                              color: _locationController.text.isNotEmpty 
                                  ? Colors.blue.shade700 
                                  : Colors.grey.shade400, 
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'View in Maps',
                              style: TextStyle(
                                color: _locationController.text.isNotEmpty 
                                    ? Colors.blue.shade700 
                                    : Colors.grey.shade400, 
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.open_in_new, 
                              color: _locationController.text.isNotEmpty 
                                  ? Colors.blue.shade700 
                                  : Colors.grey.shade400, 
                              size: 16,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                  
                  // 6. Work Time
                  _buildTimeSection(),
                  const SizedBox(height: 24),
                  
                  // 7. Break Time
                  _buildBreakSection(),
                  const SizedBox(height: 24),
                  
                  // 8. Allowances (only if permitted)
                  if (_canAddAllowances) ...[
                    _buildAllowancesSection(),
                    const SizedBox(height: 24),
                  ],
                  
                  // 9. Photos
                  _buildPhotosSection(),
                  const SizedBox(height: 24),
                  
                  // 10. Notes
                  _buildTextField(
                    label: 'Notes',
                    controller: _notesController,
                    hint: 'Add any notes about your work...',
                    maxLines: 3,
                  ),
                  const SizedBox(height: 32),
                  
                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submitWorkLog,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accent,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Submit for Approval', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchableDropdown({
    required String label,
    required String hint,
    required String? selectedValue,
    required List<dynamic> items,  // Changed from List<Map> to List<dynamic>
    required String valueKey,
    required String displayKey,
    String? subtitleKey,
    required Function(String?) onChanged,
    bool optional = false,
  }) {
    final selectedItem = items.firstWhere(
      (item) => item[valueKey]?.toString() == selectedValue,
      orElse: () => <String, dynamic>{},
    );
    final displayText = selectedItem[displayKey]?.toString() ?? hint;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
          if (optional) Text(' (optional)', style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
        ]),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => showSearchableDropdown<String>(
            context: context,
            title: 'Select $label',
            items: items.map((item) => _SearchableDropdownItem(
              value: item[valueKey]?.toString() ?? '',
              label: item[displayKey]?.toString() ?? 'Unknown',
              subtitle: subtitleKey != null ? item[subtitleKey]?.toString() : null,
            )).toList(),
            selectedValue: selectedValue,
            onChanged: onChanged,
            searchHint: 'Search $label...',
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    selectedValue != null ? displayText : hint,
                    style: TextStyle(
                      fontSize: 15,
                      color: selectedValue != null ? Colors.black87 : Colors.grey.shade500,
                      fontWeight: selectedValue != null ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                ),
                Icon(Icons.keyboard_arrow_down_rounded, color: Colors.grey.shade400),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required String hint,
    IconData? icon,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            decoration: InputDecoration(
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(16),
              hintText: hint,
              prefixIcon: icon != null ? Icon(icon, color: AppColors.primary) : null,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAllowancesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Allowances (Toeslag)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
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
              border: Border.all(color: Colors.purple.shade200),
            ),
            child: Row(children: [
              Icon(Icons.info_outline, color: Colors.purple.shade700, size: 20),
              const SizedBox(width: 12),
              Expanded(child: Text('Tap "Add" to add allowances', style: TextStyle(color: Colors.purple.shade700))),
            ]),
          ),
        
        ..._allowanceEntries.asMap().entries.map((entry) {
          final index = entry.key;
          final allowance = entry.value;
          
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.purple.shade200),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: allowance.selectedTypeId,
                        decoration: const InputDecoration(
                          labelText: 'Type',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        items: [
                          const DropdownMenuItem<int>(value: null, child: Text('Custom...')),
                          ..._allowanceTypes.map((t) => DropdownMenuItem<int>(
                            value: t['id'],
                            child: Text(t['name'] ?? 'Unknown'),
                          )),
                        ],
                        onChanged: (v) => setState(() => allowance.selectedTypeId = v),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red),
                      onPressed: () => _removeAllowance(index),
                    ),
                  ],
                ),
                if (allowance.selectedTypeId == null) ...[
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Custom Name',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) => allowance.customName = v,
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Hours: '),
                    Expanded(
                      child: Slider(
                        value: allowance.hours,
                        min: 0,
                        max: 12,
                        divisions: 24,
                        label: '${allowance.hours.toStringAsFixed(1)}h',
                        onChanged: (v) => setState(() => allowance.hours = v),
                      ),
                    ),
                    Text('${allowance.hours.toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  // ... Week header, day selector, etc. (keeping the original visual design)
  
  Widget _buildWeekHeader() {
    return Container(
      color: AppColors.primary,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => Navigator.pop(context)),
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.chevron_left, color: Colors.white, size: 20),
                ),
                onPressed: _previousWeek,
              ),
              Expanded(
                child: Center(
                  child: Text('Week $_weekNumber, $_weekYear', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                ),
              ),
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.chevron_right, color: Colors.white, size: 20),
                ),
                onPressed: _nextWeek,
              ),
              const SizedBox(width: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDaySelector() {
    const days = ['MA.', 'DI.', 'WO.', 'DO.', 'VR.', 'ZA.', 'ZO.'];
    
    return Container(
      color: AppColors.primary,
      padding: const EdgeInsets.only(bottom: 16, left: 20, right: 20),
      child: Column(
        children: [
          Row(children: List.generate(7, (i) => Expanded(child: Center(child: Text(days[i], style: const TextStyle(color: Colors.white70, fontSize: 12)))))),
          const SizedBox(height: 8),
          Row(
            children: List.generate(7, (index) {
              final date = _weekStart.add(Duration(days: index));
              final isSelected = index == _selectedDayIndex;
              final isToday = DateTime.now().day == date.day && DateTime.now().month == date.month && DateTime.now().year == date.year;
              
              return Expanded(
                child: GestureDetector(
                  onTap: () => _selectDay(index),
                  child: Column(children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: isSelected ? AppColors.accent : Colors.transparent, shape: BoxShape.circle),
                      child: Center(child: Text('${date.day}', style: TextStyle(color: Colors.white, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal))),
                    ),
                    const SizedBox(height: 4),
                    Container(width: 4, height: 4, decoration: BoxDecoration(color: isToday ? Colors.white : Colors.transparent, shape: BoxShape.circle)),
                  ]),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildDateBanner() {
    const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
    const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      color: Colors.grey.shade800,
      child: Center(child: Text('${days[_selectedDate.weekday - 1]} ${_selectedDate.day} ${months[_selectedDate.month - 1]}., ${_selectedDate.year}', style: const TextStyle(color: Colors.white, fontSize: 14))),
    );
  }

  Widget _buildDayWorklogsSection() {
    if (_loadingDayWorklogs) {
      return Container(
        padding: const EdgeInsets.all(16),
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    
    if (_dayWorklogs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.blue.shade200),
        ),
        child: Row(children: [
          Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text('No worklogs submitted for this day yet', style: TextStyle(color: Colors.blue.shade700))),
        ]),
      );
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Submitted Today', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            Text('${_dayWorklogs.length} entry', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 8),
        ..._dayWorklogs.map((wl) {
          final status = wl['status']?.toString().toLowerCase() ?? 'pending';
          final startTime = wl['start_time']?.toString().substring(0, 5) ?? '--:--';
          final endTime = wl['end_time']?.toString().substring(0, 5) ?? '--:--';
          final projectName = wl['project_name'] ?? wl['project']?['name'] ?? 'Unknown Project';
          // Parse calculated_hours - handle both String and double
          final rawHours = wl['calculated_hours'];
          final hours = rawHours is num 
              ? rawHours.toStringAsFixed(1) 
              : (double.tryParse(rawHours?.toString() ?? '0') ?? 0.0).toStringAsFixed(1);
          
          Color statusColor;
          IconData statusIcon;
          String statusLabel;
          
          switch (status) {
            case 'approved':
              statusColor = Colors.green;
              statusIcon = Icons.check_circle;
              statusLabel = 'Approved';
              break;
            case 'rejected':
              statusColor = Colors.red;
              statusIcon = Icons.cancel;
              statusLabel = 'Rejected';
              break;
            default:
              statusColor = Colors.orange;
              statusIcon = Icons.schedule;
              statusLabel = 'Pending';
          }
          
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border(left: BorderSide(color: statusColor, width: 4)),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 5)],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(statusIcon, color: statusColor, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(projectName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('$startTime - $endTime · ${hours}h', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          );
        }),
        const Divider(height: 24),
      ],
    );
  }

  Widget _buildTimeSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Work Time', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _TimePickerField(label: 'Start', time: _startTime, onTap: () async {
            final t = await showTimePicker(context: context, initialTime: _startTime);
            if (t != null) setState(() => _startTime = t);
          })),
          const SizedBox(width: 12),
          Expanded(child: _TimePickerField(label: 'End', time: _endTime, onTap: () async {
            final t = await showTimePicker(context: context, initialTime: _endTime);
            if (t != null) setState(() => _endTime = t);
          })),
        ]),
      ],
    );
  }

  Widget _buildBreakSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(children: [
              const Text('Breaks', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
              Text(' (optional)', style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
            ]),
            GestureDetector(
              onTap: () => setState(() => _breaks.add(_BreakEntry())),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, size: 16, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text('Add Break', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_breaks.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text('No breaks added', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
            ),
          )
        else
          Column(
            children: _breaks.asMap().entries.map((entry) {
              final index = entry.key;
              final brk = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () async {
                          final t = await showTimePicker(context: context, initialTime: brk.start ?? const TimeOfDay(hour: 12, minute: 0));
                          if (t != null) setState(() => _breaks[index].start = t);
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Start', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                            Text(brk.start != null ? '${brk.start!.hour.toString().padLeft(2, '0')}:${brk.start!.minute.toString().padLeft(2, '0')}' : '--:--',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                    Container(width: 1, height: 30, color: Colors.grey.shade200),
                    Expanded(
                      child: GestureDetector(
                        onTap: () async {
                          final t = await showTimePicker(context: context, initialTime: brk.end ?? const TimeOfDay(hour: 12, minute: 30));
                          if (t != null) setState(() => _breaks[index].end = t);
                        },
                        child: Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('End', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                              Text(brk.end != null ? '${brk.end!.hour.toString().padLeft(2, '0')}:${brk.end!.minute.toString().padLeft(2, '0')}' : '--:--',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (brk.durationMinutes > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('${brk.durationMinutes} min', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.orange.shade700)),
                      ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => setState(() => _breaks.removeAt(index)),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.close, size: 16, color: Colors.red.shade400),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildPhotosSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Photos', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
        const SizedBox(height: 8),
        SizedBox(
          height: 100,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              GestureDetector(
                onTap: () => _showPhotoSourcePicker(),
                child: Container(
                  width: 100, height: 100,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade300)),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.add_a_photo, color: Colors.grey.shade400, size: 28),
                    const SizedBox(height: 4),
                    Text('Add Photo', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                  ]),
                ),
              ),
              ..._photos.map((photo) => Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Stack(children: [
                  Container(width: 100, height: 100, decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), image: DecorationImage(image: FileImage(photo), fit: BoxFit.cover))),
                  Positioned(top: 4, right: 4, child: GestureDetector(
                    onTap: () => setState(() => _photos.remove(photo)),
                    child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle), child: const Icon(Icons.close, color: Colors.white, size: 14)),
                  )),
                ]),
              )),
            ],
          ),
        ),
      ],
    );
  }

  void _showPhotoSourcePicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Add Photo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildPhotoOption(
                    icon: Icons.camera_alt_rounded,
                    label: 'Camera',
                    color: const Color(0xFF3B82F6),
                    onTap: () async {
                      Navigator.pop(context);
                      final picker = ImagePicker();
                      final photo = await picker.pickImage(source: ImageSource.camera);
                      if (photo != null) setState(() => _photos.add(File(photo.path)));
                    },
                  ),
                  _buildPhotoOption(
                    icon: Icons.photo_library_rounded,
                    label: 'Gallery',
                    color: const Color(0xFF10B981),
                    onTap: () async {
                      Navigator.pop(context);
                      final picker = ImagePicker();
                      final photo = await picker.pickImage(source: ImageSource.gallery);
                      if (photo != null) setState(() => _photos.add(File(photo.path)));
                    },
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhotoOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 32),
          ),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: color)),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _locationController.removeListener(_onLocationChanged);
    _notesController.dispose();
    _locationController.dispose();
    super.dispose();
  }
}

class _TimePickerField extends StatelessWidget {
  final String label;
  final TimeOfDay? time;
  final VoidCallback onTap;
  final bool optional;

  const _TimePickerField({required this.label, required this.time, required this.onTap, this.optional = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)]),
        child: Row(children: [
          const Icon(Icons.access_time, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
            Text(time != null ? '${time!.hour.toString().padLeft(2, '0')}:${time!.minute.toString().padLeft(2, '0')}' : optional ? '--:--' : 'Select', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ]),
        ]),
      ),
    );
  }
}

class _AllowanceEntry {
  int? selectedTypeId;
  String customName = '';
  double hours = 0;
}

class _BreakEntry {
  TimeOfDay? start;
  TimeOfDay? end;
  
  _BreakEntry({this.start, this.end});
  
  int get durationMinutes {
    if (start == null || end == null) return 0;
    final startMins = start!.hour * 60 + start!.minute;
    final endMins = end!.hour * 60 + end!.minute;
    return endMins > startMins ? endMins - startMins : 0;
  }
  
  Map<String, String> toJson() => {
    'start': start != null ? '${start!.hour.toString().padLeft(2, '0')}:${start!.minute.toString().padLeft(2, '0')}' : '',
    'end': end != null ? '${end!.hour.toString().padLeft(2, '0')}:${end!.minute.toString().padLeft(2, '0')}' : '',
  };
}

/// Modern Searchable Dropdown with bottom sheet
class _SearchableDropdownItem<T> {
  final T value;
  final String label;
  final String? subtitle;
  
  _SearchableDropdownItem({required this.value, required this.label, this.subtitle});
}

void showSearchableDropdown<T>({
  required BuildContext context,
  required String title,
  required List<_SearchableDropdownItem<T>> items,
  required T? selectedValue,
  required Function(T?) onChanged,
  String searchHint = 'Search...',
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _SearchableDropdownSheet<T>(
      title: title,
      items: items,
      selectedValue: selectedValue,
      onChanged: (val) {
        Navigator.pop(ctx);
        onChanged(val);
      },
      searchHint: searchHint,
    ),
  );
}

class _SearchableDropdownSheet<T> extends StatefulWidget {
  final String title;
  final List<_SearchableDropdownItem<T>> items;
  final T? selectedValue;
  final Function(T?) onChanged;
  final String searchHint;

  const _SearchableDropdownSheet({
    required this.title,
    required this.items,
    required this.selectedValue,
    required this.onChanged,
    required this.searchHint,
  });

  @override
  State<_SearchableDropdownSheet<T>> createState() => _SearchableDropdownSheetState<T>();
}

class _SearchableDropdownSheetState<T> extends State<_SearchableDropdownSheet<T>> {
  final TextEditingController _searchController = TextEditingController();
  List<_SearchableDropdownItem<T>> _filteredItems = [];

  @override
  void initState() {
    super.initState();
    _filteredItems = widget.items;
    _searchController.addListener(_filterItems);
  }

  void _filterItems() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredItems = widget.items;
      } else {
        _filteredItems = widget.items.where((item) {
          return item.label.toLowerCase().contains(query) ||
              (item.subtitle?.toLowerCase().contains(query) ?? false);
        }).toList();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Title
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              widget.title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          // Search field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  border: InputBorder.none,
                  icon: Icon(Icons.search, color: Colors.grey.shade500),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                          },
                        )
                      : null,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Items list
          Expanded(
            child: _filteredItems.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 8),
                        Text('No results found', style: TextStyle(color: Colors.grey.shade500)),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: _filteredItems.length,
                    itemBuilder: (context, index) {
                      final item = _filteredItems[index];
                      final isSelected = item.value == widget.selectedValue;
                      return InkWell(
                        onTap: () => widget.onChanged(item.value),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primary.withOpacity(0.08) : null,
                            border: Border(
                              bottom: BorderSide(color: Colors.grey.shade100),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.label,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                        color: isSelected ? AppColors.primary : Colors.black87,
                                      ),
                                    ),
                                    if (item.subtitle != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        item.subtitle!,
                                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              if (isSelected)
                                Icon(Icons.check_circle, color: AppColors.primary, size: 22),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

