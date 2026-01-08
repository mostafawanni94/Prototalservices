/// My Shifts Screen
/// 
/// Shows employee's scheduled and upcoming shifts from planning system.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/shift_service.dart';
import 'assigned_shift_detail_screen.dart';

class MyShiftsScreen extends StatefulWidget {
  const MyShiftsScreen({super.key});

  @override
  State<MyShiftsScreen> createState() => _MyShiftsScreenState();
}

class _MyShiftsScreenState extends State<MyShiftsScreen> {
  final ShiftService _shiftService = ShiftService();
  List<AssignedShift> _shifts = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _currentPage = 1;
  String? _error;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadShifts();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      _loadMoreShifts();
    }
  }

  Future<void> _loadShifts() async {
    setState(() {
      _loading = true;
      _error = null;
      _currentPage = 1;
    });

    try {
      final response = await _shiftService.getMyAssignments(page: 1, pageSize: 10);
      setState(() {
        _shifts = response.results;
        _hasMore = response.hasMore;
        _currentPage = response.hasMore ? 2 : 1;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMoreShifts() async {
    if (_loadingMore || !_hasMore) return;

    setState(() {
      _loadingMore = true;
    });

    try {
      final response = await _shiftService.getMyAssignments(page: _currentPage, pageSize: 10);
      setState(() {
        _shifts.addAll(response.results);
        _hasMore = response.hasMore;
        _currentPage = response.hasMore ? _currentPage + 1 : _currentPage;
        _loadingMore = false;
      });
    } catch (e) {
      setState(() {
        _loadingMore = false;
      });
    }
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
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'My Shifts',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            Text(
              '${_shifts.length} upcoming shifts',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _loadShifts,
            icon: Icon(Icons.refresh_rounded, color: Colors.grey[600]),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              strokeWidth: 3,
              color: Color(0xFF1E3A5F),
            ),
            SizedBox(height: 16),
            Text(
              'Loading shifts...',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 15,
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: Colors.red[300],
              ),
              const SizedBox(height: 16),
              Text(
                'Failed to load shifts',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[500],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadShifts,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A5F),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_shifts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Color(0xFFE0F2FE),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.calendar_today_rounded,
                size: 48,
                color: Color(0xFF0EA5E9),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'No upcoming shifts',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Your scheduled shifts will appear here',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    // Group shifts by date
    final Map<String, List<AssignedShift>> groupedShifts = {};
    for (final shift in _shifts) {
      final dateKey = DateFormat('yyyy-MM-dd').format(shift.date);
      groupedShifts.putIfAbsent(dateKey, () => []).add(shift);
    }

    return RefreshIndicator(
      onRefresh: _loadShifts,
      color: const Color(0xFF1E3A5F),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: groupedShifts.length + (_hasMore || _loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          // Loading indicator at the end
          if (index == groupedShifts.length) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: _loadingMore
                    ? const CircularProgressIndicator()
                    : TextButton(
                        onPressed: _loadMoreShifts,
                        child: const Text('Load more'),
                      ),
              ),
            );
          }

          final dateKey = groupedShifts.keys.elementAt(index);
          final shiftsForDate = groupedShifts[dateKey]!;
          final date = DateTime.parse(dateKey);
          final isToday = DateFormat('yyyy-MM-dd').format(DateTime.now()) == dateKey;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date header
              Padding(
                padding: EdgeInsets.only(left: 4, bottom: 12, top: index > 0 ? 16 : 0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isToday ? const Color(0xFF10B981) : const Color(0xFF1E3A5F),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isToday ? 'TODAY' : DateFormat('EEE, MMM d').format(date).toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Shifts for this date
              ...shiftsForDate.map((shift) => _buildShiftCard(shift)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildShiftCard(AssignedShift shift) {
    final shiftColor = _parseColor(shift.shiftColor);
    
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AssignedShiftDetailScreen(shift: shift),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
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
          children: [
            // Status indicator bar with shift color
            Container(
              height: 4,
              decoration: BoxDecoration(
                color: shiftColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header row: Project + Shift badge
                  Row(
                    children: [
                      // Project icon
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.business_rounded,
                          size: 20,
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Project info
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              shift.projectName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            if (shift.projectCity.isNotEmpty)
                              Text(
                                shift.projectCity,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey[500],
                                ),
                              ),
                          ],
                        ),
                      ),
                      // Shift name badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: shiftColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          shift.shiftName,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: shiftColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Info row: Time + Supervisor
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      // Scheduled time
                      _buildInfoChip(
                        icon: Icons.access_time_rounded,
                        label: '${shift.startTime.substring(0, 5)} - ${shift.endTime.substring(0, 5)}',
                        color: const Color(0xFF6366F1),
                      ),
                      // Location
                      if (shift.fullAddress.isNotEmpty)
                        _buildInfoChip(
                          icon: Icons.location_on_rounded,
                          label: shift.fullAddress.length > 25 
                              ? '${shift.fullAddress.substring(0, 25)}...' 
                              : shift.fullAddress,
                          color: const Color(0xFF10B981),
                        ),
                      // Supervisor
                      if (shift.supervisorName != null && shift.supervisorName!.isNotEmpty)
                        _buildInfoChip(
                          icon: Icons.person_outline_rounded,
                          label: shift.supervisorName!,
                          color: const Color(0xFF8B5CF6),
                        ),
                    ],
                  ),
                  // Work log status if exists
                  if (shift.hasWorkLog) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _getWorkLogStatusColor(shift.latestWorkLogStatus).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _getWorkLogStatusColor(shift.latestWorkLogStatus).withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _getWorkLogStatusIcon(shift.latestWorkLogStatus),
                            size: 18,
                            color: _getWorkLogStatusColor(shift.latestWorkLogStatus),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _getWorkLogStatusText(shift.latestWorkLogStatus),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: _getWorkLogStatusColor(shift.latestWorkLogStatus),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  // Today action hint
                  if (shift.isToday && !shift.hasWorkLog) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.edit_calendar_rounded,
                            size: 18,
                            color: Colors.amber[700],
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Tap to fill your actual work times',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Colors.amber[800],
                              ),
                            ),
                          ),
                          Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 14,
                            color: Colors.amber[700],
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _parseColor(String colorHex) {
    try {
      return Color(int.parse(colorHex.replaceFirst('#', '0xFF')));
    } catch (e) {
      return const Color(0xFF10B981); // Default green
    }
  }

  Color _getWorkLogStatusColor(String? status) {
    switch (status) {
      case 'approved': return const Color(0xFF10B981);
      case 'submitted': return const Color(0xFFF59E0B);
      case 'rejected': return const Color(0xFFEF4444);
      default: return const Color(0xFF6B7280);
    }
  }

  IconData _getWorkLogStatusIcon(String? status) {
    switch (status) {
      case 'approved': return Icons.check_circle_rounded;
      case 'submitted': return Icons.hourglass_empty_rounded;
      case 'rejected': return Icons.cancel_rounded;
      default: return Icons.info_outline_rounded;
    }
  }

  String _getWorkLogStatusText(String? status) {
    switch (status) {
      case 'approved': return 'Work log approved';
      case 'submitted': return 'Work log pending approval';
      case 'rejected': return 'Work log needs revision';
      default: return 'Work log status unknown';
    }
  }

  Widget _buildInfoChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
