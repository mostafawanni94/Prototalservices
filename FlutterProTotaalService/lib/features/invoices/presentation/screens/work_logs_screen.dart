/// Work Logs Screen - Enhanced History View
/// 
/// Shows work history with weekly hours summary and day filtering.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../viewmodels/invoice_viewmodel.dart';
import '../../data/invoice_service.dart';
import '../../../../core/widgets/app_widgets.dart';

class WorkLogsScreen extends StatefulWidget {
  const WorkLogsScreen({super.key});

  @override
  State<WorkLogsScreen> createState() => _WorkLogsScreenState();
}

class _WorkLogsScreenState extends State<WorkLogsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late ScrollController _scrollController;
  
  // Week selection
  late DateTime _selectedWeekStart;
  DateTime? _selectedDay; // null means show all days in the week

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_onTabChanged);
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
    // Initialize to current week (Monday)
    _selectedWeekStart = _getWeekStart(DateTime.now());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InvoiceViewModel>().loadWorkLogs();
    });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      // Load more when user is near the bottom
      context.read<InvoiceViewModel>().loadMoreWorkLogs();
    }
  }

  /// Get Monday of the week containing the given date
  DateTime _getWeekStart(DateTime date) {
    final weekday = date.weekday; // 1 = Monday, 7 = Sunday
    return DateTime(date.year, date.month, date.day - (weekday - 1));
  }

  void _onTabChanged() {
    final vm = context.read<InvoiceViewModel>();
    switch (_tabController.index) {
      case 0: vm.setWorkLogFilter(WorkLogFilter.all); break;
      case 1: vm.setWorkLogFilter(WorkLogFilter.approved); break;
      case 2: vm.setWorkLogFilter(WorkLogFilter.pending); break;
      case 3: vm.setWorkLogFilter(WorkLogFilter.rejected); break;
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
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

  int _getIsoWeekNumber(DateTime date) {
    final jan1 = DateTime(date.year, 1, 1);
    final jan1Weekday = jan1.weekday;
    final firstThursday = jan1.add(Duration(days: (4 - jan1Weekday + 7) % 7));
    final diff = date.difference(firstThursday).inDays;
    return (diff / 7).floor() + 1;
  }

  /// Filter logs by selected week and day
  List<WorkLogModel> _filterLogsByWeekAndDay(List<WorkLogModel> logs) {
    final weekEnd = _selectedWeekStart.add(const Duration(days: 7));
    
    return logs.where((log) {
      // First filter by week
      if (log.workDate.isBefore(_selectedWeekStart) || !log.workDate.isBefore(weekEnd)) {
        return false;
      }
      
      // Then filter by day if selected
      if (_selectedDay != null) {
        final isSameDay = log.workDate.year == _selectedDay!.year &&
            log.workDate.month == _selectedDay!.month &&
            log.workDate.day == _selectedDay!.day;
        if (!isSameDay) return false;
      }
      
      return true;
    }).toList();
  }

  /// Calculate total hours for the week
  double _calculateWeekTotalHours(List<WorkLogModel> allLogs) {
    final weekEnd = _selectedWeekStart.add(const Duration(days: 7));
    return allLogs.where((log) {
      return !log.workDate.isBefore(_selectedWeekStart) && log.workDate.isBefore(weekEnd);
    }).fold(0.0, (sum, log) => sum + log.billableHours);
  }

  /// Calculate hours for a specific day
  double _getHoursForDay(List<WorkLogModel> allLogs, DateTime day) {
    return allLogs.where((log) {
      return log.workDate.year == day.year &&
          log.workDate.month == day.month &&
          log.workDate.day == day.day;
    }).fold(0.0, (sum, log) => sum + log.billableHours);
  }

  /// Check if a day has work logs
  bool _dayHasLogs(List<WorkLogModel> allLogs, DateTime day) {
    return allLogs.any((log) {
      return log.workDate.year == day.year &&
          log.workDate.month == day.month &&
          log.workDate.day == day.day;
    });
  }

  @override
  Widget build(BuildContext context) {
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
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Approved'),
            Tab(text: 'Pending'),
            Tab(text: 'Rejected'),
          ],
        ),
      ),
      body: Consumer<InvoiceViewModel>(
        builder: (context, vm, _) {
          if (vm.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final weekTotalHours = _calculateWeekTotalHours(vm.allWorkLogs);
          final filteredLogs = _filterLogsByWeekAndDay(vm.filteredWorkLogs);

          return Column(
            children: [
              // Week Selector & Hours Summary
              _buildWeekSelector(weekNumber, weekTotalHours),
              
              // Day Selector
              _buildDaySelector(vm.allWorkLogs),
              
              // Selected day info
              if (_selectedDay != null)
                _buildSelectedDayInfo(vm.allWorkLogs, filteredLogs.length),
              
              // Work Logs List
              Expanded(
                child: filteredLogs.isEmpty
                    ? EmptyState(
                        icon: Icons.work_off_outlined,
                        title: _selectedDay != null 
                            ? 'No work logs for this day'
                            : 'No work logs this week',
                        message: 'Work logs will appear here when submitted',
                      )
                    : RefreshIndicator(
                        onRefresh: () => vm.loadWorkLogs(),
                        child: ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredLogs.length + (vm.hasMore || vm.isLoadingMore ? 1 : 0),
                          itemBuilder: (_, i) {
                            // Show loading indicator at the end
                            if (i == filteredLogs.length) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                child: Center(
                                  child: vm.isLoadingMore
                                      ? const CircularProgressIndicator()
                                      : TextButton(
                                          onPressed: () => vm.loadMoreWorkLogs(),
                                          child: const Text('Load more'),
                                        ),
                                ),
                              );
                            }
                            return _WorkLogCard(
                              workLog: filteredLogs[i],
                              onTap: () => _showWorkLogDetails(filteredLogs[i]),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
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
  Widget _buildDaySelector(List<WorkLogModel> allLogs) {
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
          final hasLogs = _dayHasLogs(allLogs, day);

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
  Widget _buildSelectedDayInfo(List<WorkLogModel> allLogs, int logsCount) {
    final hoursForDay = _getHoursForDay(allLogs, _selectedDay!);
    final dayName = DateFormat('EEEE d MMMM, yyyy').format(_selectedDay!);

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

  void _showWorkLogDetails(WorkLogModel log) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _WorkLogDetailsSheet(workLog: log),
    );
  }
}

/// Work Log Card with full details
class _WorkLogCard extends StatelessWidget {
  final WorkLogModel workLog;
  final VoidCallback onTap;

  const _WorkLogCard({required this.workLog, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border(left: BorderSide(color: _statusColor, width: 4)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8)],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Customer + Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      workLog.customerName.isNotEmpty ? workLog.customerName : workLog.projectName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _buildStatusBadge(),
                ],
              ),
              const SizedBox(height: 8),
              
              // Project name (if different from customer)
              if (workLog.projectName.isNotEmpty && workLog.customerName.isNotEmpty)
                Text(
                  workLog.projectName,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              
              const SizedBox(height: 12),
              
              // Date + Time + Hours
              Row(
                children: [
                  _buildInfoChip(Icons.calendar_today, _formatDate(workLog.workDate)),
                  const SizedBox(width: 12),
                  _buildInfoChip(Icons.access_time, '${workLog.startTime.substring(0, 5)} - ${workLog.endTime.substring(0, 5)}'),
                  const SizedBox(width: 12),
                  _buildInfoChip(Icons.timelapse, '${workLog.billableHours.toStringAsFixed(1)}h'),
                ],
              ),
              
              // Pending status message
              if (workLog.isPending) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.hourglass_empty, color: Colors.orange, size: 16),
                      SizedBox(width: 4),
                      Text(
                        'Awaiting admin approval',
                        style: TextStyle(color: Colors.orange, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
              
              // Rejection reason
              if (workLog.needsEdit && workLog.rejectionReason != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber, color: AppColors.error, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          workLog.rejectionReason!,
                          style: const TextStyle(color: AppColors.error, fontSize: 12),
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
    );
  }

  Color get _statusColor {
    if (workLog.isDone) return AppColors.success;
    if (workLog.isPending) return Colors.orange;
    if (workLog.needsEdit) return AppColors.error;
    return Colors.grey;
  }

  Widget _buildStatusBadge() {
    Color bgColor;
    Color textColor;
    
    if (workLog.isDone) {
      bgColor = AppColors.success.withOpacity(0.1);
      textColor = AppColors.success;
    } else if (workLog.isPending) {
      bgColor = Colors.orange.withOpacity(0.1);
      textColor = Colors.orange;
    } else if (workLog.needsEdit) {
      bgColor = AppColors.error.withOpacity(0.1);
      textColor = AppColors.error;
    } else {
      bgColor = Colors.grey.withOpacity(0.1);
      textColor = Colors.grey;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        workLog.statusLabel,
        style: TextStyle(color: textColor, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
      ],
    );
  }

  String _formatDate(DateTime date) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${days[date.weekday - 1]}, ${date.day}/${date.month}';
  }
}

/// Work Log Details Bottom Sheet
class _WorkLogDetailsSheet extends StatelessWidget {
  final WorkLogModel workLog;

  const _WorkLogDetailsSheet({required this.workLog});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
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
            
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.work, color: AppColors.primary),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        workLog.customerName.isNotEmpty ? workLog.customerName : workLog.projectName,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      if (workLog.projectName.isNotEmpty && workLog.customerName.isNotEmpty)
                        Text(workLog.projectName, style: TextStyle(color: Colors.grey.shade600)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            
            // Details Grid
            _buildDetailRow('Date', _formatFullDate(workLog.workDate)),
            _buildDetailRow('Time', '${workLog.startTime.substring(0, 5)} - ${workLog.endTime.substring(0, 5)}'),
            _buildDetailRow('Hours', '${workLog.billableHours.toStringAsFixed(1)} hours'),
            if (workLog.supervisorName != null)
              _buildDetailRow('Supervisor', workLog.supervisorName!),
            if (workLog.serviceName != null)
              _buildDetailRow('Service', workLog.serviceName!),
            if (workLog.location != null && workLog.location!.isNotEmpty)
              _buildDetailRow('Location', workLog.location!),
            _buildDetailRow('Status', workLog.statusLabel),
            
            if (workLog.notes != null && workLog.notes!.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('Notes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(workLog.notes!),
              ),
            ],
            
            if (workLog.needsEdit && workLog.rejectionReason != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.warning_amber, color: AppColors.error, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Correction Required',
                          style: TextStyle(color: AppColors.error, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(workLog.rejectionReason!, style: const TextStyle(color: AppColors.error)),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
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

  String _formatFullDate(DateTime date) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[date.weekday - 1]}, ${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
