/// Work Log History Screen
/// 
/// Shows employee's work log history with weekly hours summary and day filtering.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/worklog_service.dart';
import '../../../../core/widgets/app_widgets.dart';

class WorkLogHistoryScreen extends StatefulWidget {
  const WorkLogHistoryScreen({super.key});

  @override
  State<WorkLogHistoryScreen> createState() => _WorkLogHistoryScreenState();
}

class _WorkLogHistoryScreenState extends State<WorkLogHistoryScreen> with SingleTickerProviderStateMixin {
  final WorkLogService _service = WorkLogService();
  late TabController _tabController;
  
  List<WorkLogModel> _allLogs = [];
  bool _isLoading = true;
  
  // Week selection
  late DateTime _selectedWeekStart;
  DateTime? _selectedDay; // null means show all days in the week

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    // Initialize to current week (Monday)
    _selectedWeekStart = _getWeekStart(DateTime.now());
    _loadWorkLogs();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Get Monday of the week containing the given date
  DateTime _getWeekStart(DateTime date) {
    final weekday = date.weekday; // 1 = Monday, 7 = Sunday
    return DateTime(date.year, date.month, date.day - (weekday - 1));
  }

  Future<void> _loadWorkLogs() async {
    setState(() => _isLoading = true);
    try {
      final logs = await _service.getMyWorkLogs();
      setState(() => _allLogs = logs);
    } catch (e) {
      debugPrint('Failed to load work logs: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Get logs for the selected week
  List<WorkLogModel> _getWeekLogs() {
    final weekEnd = _selectedWeekStart.add(const Duration(days: 7));
    return _allLogs.where((log) {
      return !log.date.isBefore(_selectedWeekStart) && log.date.isBefore(weekEnd);
    }).toList();
  }

  /// Get logs for the selected day (or all if no day selected)
  List<WorkLogModel> _filterByStatusAndDay(String? status) {
    final weekLogs = _getWeekLogs();
    
    return weekLogs.where((log) {
      // Filter by day if selected
      if (_selectedDay != null) {
        final isSameDay = log.date.year == _selectedDay!.year &&
            log.date.month == _selectedDay!.month &&
            log.date.day == _selectedDay!.day;
        if (!isSameDay) return false;
      }
      // Filter by status
      if (status == null) return true;
      return log.status == status;
    }).toList();
  }

  /// Calculate total hours for the week
  double _calculateWeekTotalHours() {
    return _getWeekLogs().fold(0.0, (sum, log) => sum + log.hoursWorked);
  }

  /// Calculate hours for a specific day
  double _getHoursForDay(DateTime day) {
    return _allLogs.where((log) {
      return log.date.year == day.year &&
          log.date.month == day.month &&
          log.date.day == day.day;
    }).fold(0.0, (sum, log) => sum + log.hoursWorked);
  }

  /// Check if a day has work logs
  bool _dayHasLogs(DateTime day) {
    return _allLogs.any((log) {
      return log.date.year == day.year &&
          log.date.month == day.month &&
          log.date.day == day.day;
    });
  }

  void _previousWeek() {
    setState(() {
      _selectedWeekStart = _selectedWeekStart.subtract(const Duration(days: 7));
      _selectedDay = null;
    });
  }

  void _nextWeek() {
    setState(() {
      _selectedWeekStart = _selectedWeekStart.add(const Duration(days: 7));
      _selectedDay = null;
    });
  }

  void _selectDay(DateTime day) {
    setState(() {
      if (_selectedDay != null && 
          _selectedDay!.year == day.year && 
          _selectedDay!.month == day.month && 
          _selectedDay!.day == day.day) {
        // Deselect if already selected
        _selectedDay = null;
      } else {
        _selectedDay = day;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final allFiltered = _filterByStatusAndDay(null);
    final approved = _filterByStatusAndDay('approved');
    final pending = _filterByStatusAndDay('submitted');
    final rejected = _filterByStatusAndDay('rejected');
    
    final weekTotalHours = _calculateWeekTotalHours();
    final weekNumber = _getIsoWeekNumber(_selectedWeekStart);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Work History'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: [
            Tab(text: 'All (${allFiltered.length})'),
            Tab(text: 'Approved (${approved.length})'),
            Tab(text: 'Pending (${pending.length})'),
            Tab(text: 'Rejected (${rejected.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Week Selector & Hours Summary
          _buildWeekSelector(weekNumber, weekTotalHours),
          
          // Day Selector
          _buildDaySelector(),
          
          // Selected day info
          if (_selectedDay != null)
            _buildSelectedDayInfo(),
          
          // Logs List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildLogsList(allFiltered),
                      _buildLogsList(approved),
                      _buildLogsList(pending),
                      _buildLogsList(rejected),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  /// Week selector with navigation and total hours
  Widget _buildWeekSelector(int weekNumber, double totalHours) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primary,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Previous week button
          Material(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: _previousWeek,
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Icon(Icons.chevron_left, color: Colors.white, size: 24),
              ),
            ),
          ),
          
          // Week info & total hours
          Expanded(
            child: Column(
              children: [
                Text(
                  'Week $weekNumber, ${_selectedWeekStart.year}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${totalHours.toStringAsFixed(1)} hours total',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Next week button
          Material(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: _nextWeek,
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Icon(Icons.chevron_right, color: Colors.white, size: 24),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Day selector row showing days of the week
  Widget _buildDaySelector() {
    final days = List.generate(7, (i) => _selectedWeekStart.add(Duration(days: i)));
    final dayNames = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'];
    final today = DateTime.now();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      color: AppColors.primary.withOpacity(0.9),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(7, (index) {
          final day = days[index];
          final isSelected = _selectedDay != null &&
              _selectedDay!.year == day.year &&
              _selectedDay!.month == day.month &&
              _selectedDay!.day == day.day;
          final isToday = day.year == today.year &&
              day.month == today.month &&
              day.day == today.day;
          final hasLogs = _dayHasLogs(day);

          return Expanded(
            child: GestureDetector(
              onTap: () => _selectDay(day),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected 
                      ? Colors.orange 
                      : (isToday ? Colors.white.withOpacity(0.15) : Colors.transparent),
                  borderRadius: BorderRadius.circular(12),
                  border: isToday && !isSelected 
                      ? Border.all(color: Colors.white.withOpacity(0.5), width: 1)
                      : null,
                ),
                child: Column(
                  children: [
                    Text(
                      dayNames[index],
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${day.day}',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    // Hours indicator dot
                    if (hasLogs)
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.white : Colors.greenAccent,
                          shape: BoxShape.circle,
                        ),
                      )
                    else
                      const SizedBox(height: 6),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  /// Info bar showing selected day details
  Widget _buildSelectedDayInfo() {
    final hoursForDay = _getHoursForDay(_selectedDay!);
    final dayName = DateFormat('EEEE d MMMM, yyyy', 'nl_NL').format(_selectedDay!);
    final logsCount = _filterByStatusAndDay(null).length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Colors.orange.shade50,
      child: Row(
        children: [
          Icon(Icons.calendar_today, color: Colors.orange.shade700, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              dayName,
              style: TextStyle(
                color: Colors.orange.shade900,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.orange.shade200,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${hoursForDay.toStringAsFixed(1)}h • $logsCount logs',
              style: TextStyle(
                color: Colors.orange.shade900,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => setState(() => _selectedDay = null),
            child: Icon(Icons.close, color: Colors.orange.shade700, size: 20),
          ),
        ],
      ),
    );
  }

  int _getIsoWeekNumber(DateTime date) {
    // ISO week number calculation
    final jan1 = DateTime(date.year, 1, 1);
    final jan1Weekday = jan1.weekday;
    final firstThursday = jan1.add(Duration(days: (4 - jan1Weekday + 7) % 7));
    final diff = date.difference(firstThursday).inDays;
    return (diff / 7).floor() + 1;
  }

  Widget _buildLogsList(List<WorkLogModel> logs) {
    if (logs.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.work_outline, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              _selectedDay != null 
                  ? 'No work logs for this day'
                  : 'No work logs this week',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadWorkLogs,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        itemCount: logs.length,
        itemBuilder: (context, index) {
          final log = logs[index];
          return _buildLogCard(log);
        },
      ),
    );
  }

  Widget _buildLogCard(WorkLogModel log) {
    Color statusColor;
    IconData statusIcon;
    String statusText;
    switch (log.status) {
      case 'approved':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        statusText = 'Approved';
        break;
      case 'submitted':
        statusColor = Colors.amber.shade700;
        statusIcon = Icons.pending;
        statusText = 'pending';
        break;
      case 'rejected':
        statusColor = Colors.red;
        statusIcon = Icons.cancel;
        statusText = 'Rejected';
        break;
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.edit;
        statusText = 'Draft';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: statusColor, width: 4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _showLogDetail(log),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Project name & Status
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        log.projectName ?? 'Work Log',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: statusColor.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 14, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            statusText,
                            style: TextStyle(
                              color: statusColor,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                
                // Customer name
                Text(
                  log.customerName ?? '',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
                const SizedBox(height: 12),
                
                // Time info row
                Row(
                  children: [
                    // Date
                    _infoChip(Icons.calendar_today, DateFormat('EEE, d/M').format(log.date)),
                    const SizedBox(width: 12),
                    // Time
                    _infoChip(Icons.access_time, '${log.startTime} - ${log.endTime}'),
                    const SizedBox(width: 12),
                    // Hours
                    _infoChip(Icons.timelapse, '${log.hoursWorked.toStringAsFixed(1)}h'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade500),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
        ),
      ],
    );
  }

  void _showLogDetail(WorkLogModel log) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            log.projectName ?? 'Work Log Details',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                        ),
                        _statusBadge(log.status),
                      ],
                    ),
                    if (log.customerName != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        log.customerName!,
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                      ),
                    ],
                    
                    const SizedBox(height: 24),
                    
                    // Date & Time Section
                    _sectionTitle('Date & Time'),
                    _detailRow('Date', DateFormat('EEEE, d MMMM yyyy').format(log.date)),
                    _detailRow('Time', '${log.startTime} - ${log.endTime}'),
                    _detailRow('Break', '${log.breakMinutes} minutes'),
                    _detailRow('Total Hours', '${log.hoursWorked.toStringAsFixed(2)} hours'),
                    
                    const SizedBox(height: 20),
                    
                    // Location Section
                    _sectionTitle('Location'),
                    if (log.locationAddress.isNotEmpty)
                      _detailRow('Address', log.locationAddress),
                    if (log.locationCity.isNotEmpty)
                      _detailRow('City', log.locationCity),
                    
                    // Supervisor Section
                    if (log.supervisorName != null && log.supervisorName!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _sectionTitle('Supervisor'),
                      _detailRow('Name', log.supervisorName!),
                    ],
                    
                    // Notes
                    if (log.notes != null && log.notes!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _sectionTitle('Notes'),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(log.notes!, style: const TextStyle(fontSize: 14)),
                      ),
                    ],
                    
                    // Rejection reason
                    if (log.rejectionReason != null && log.rejectionReason!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.warning, color: Colors.red.shade700, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Rejection Reason',
                                    style: TextStyle(
                                      color: Colors.red.shade900,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    log.rejectionReason!,
                                    style: TextStyle(color: Colors.red.shade700),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _statusBadge(String status) {
    Color color;
    String text;
    switch (status) {
      case 'approved':
        color = Colors.green;
        text = 'Approved';
        break;
      case 'submitted':
        color = Colors.amber.shade700;
        text = 'Pending';
        break;
      case 'rejected':
        color = Colors.red;
        text = 'Rejected';
        break;
      default:
        color = Colors.grey;
        text = 'Draft';
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        text,
        style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
