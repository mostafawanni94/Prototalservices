/// My Assigned Shifts Screen
/// 
/// OPTIMIZED VERSION:
/// - Uses paginated API response
/// - Only shows today + future shifts
/// - Submitted/completed shifts hidden by backend
/// - No caching, always fresh data

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../data/shift_service.dart';

class MyAssignedShiftsScreen extends StatefulWidget {
  const MyAssignedShiftsScreen({super.key});

  @override
  State<MyAssignedShiftsScreen> createState() => _MyAssignedShiftsScreenState();
}

class _MyAssignedShiftsScreenState extends State<MyAssignedShiftsScreen> {
  final ShiftService _shiftService = ShiftService();
  
  List<AssignedShift> _shifts = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _currentPage = 1;
  bool _hasMore = false;
  int _totalCount = 0;

  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadShifts();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadShifts() async {
    setState(() {
      _loading = true;
      _error = null;
      _currentPage = 1;
    });

    try {
      final response = await _shiftService.getMyAssignments(page: 1);
      setState(() {
        _shifts = response.results;
        _hasMore = response.hasMore;
        _totalCount = response.count;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;

    setState(() => _loadingMore = true);

    try {
      final response = await _shiftService.getMyAssignments(page: _currentPage + 1);
      setState(() {
        _shifts.addAll(response.results);
        _currentPage++;
        _hasMore = response.hasMore;
        _loadingMore = false;
      });
    } catch (e) {
      setState(() => _loadingMore = false);
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'My Schedule',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            Text(
              _loading ? 'Loading...' : '$_totalCount upcoming shifts',
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
            onPressed: _loading ? null : _loadShifts,
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
            CircularProgressIndicator(strokeWidth: 3, color: Color(0xFF1E3A5F)),
            SizedBox(height: 16),
            Text('Loading your schedule...', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, size: 64, color: Colors.red[300]),
              const SizedBox(height: 16),
              Text('Failed to load schedule', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.grey[800])),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey[600])),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadShifts,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A5F),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_shifts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E3A5F).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.calendar_today_rounded, size: 48, color: Color(0xFF1E3A5F)),
              ),
              const SizedBox(height: 24),
              Text('No Upcoming Shifts', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.grey[800])),
              const SizedBox(height: 8),
              Text('You have no scheduled shifts at the moment.\nCheck back later!', textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: Colors.grey[600], height: 1.4)),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadShifts,
      color: const Color(0xFF1E3A5F),
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: _shifts.length + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _shifts.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          return _buildShiftCard(_shifts[index]);
        },
      ),
    );
  }

  Widget _buildShiftCard(AssignedShift shift) {
    final dateFormat = DateFormat('EEEE, MMM d');
    final isToday = shift.isToday;
    
    Color shiftColor;
    try {
      shiftColor = Color(int.parse(shift.shiftColor.replaceFirst('#', '0xFF')));
    } catch (_) {
      shiftColor = const Color(0xFF10B981);
    }

    return GestureDetector(
      onTap: () => _showShiftDetails(shift),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isToday 
              ? Border.all(color: shiftColor, width: 2)
              : Border.all(color: Colors.grey.withValues(alpha: 0.1)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isToday ? shiftColor.withValues(alpha: 0.1) : Colors.grey[50],
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              ),
              child: Row(
                children: [
                  Container(width: 4, height: 40, decoration: BoxDecoration(color: shiftColor, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(dateFormat.format(shift.date), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: isToday ? shiftColor : const Color(0xFF1E293B))),
                        Text(shift.shiftName, style: TextStyle(fontSize: 13, color: Colors.grey[600], fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  // WorkLog status badge
                  if (shift.hasWorkLog) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: shift.latestWorkLogStatus == 'approved' 
                            ? const Color(0xFF10B981)
                            : shift.latestWorkLogStatus == 'pending' || shift.latestWorkLogStatus == 'submitted'
                                ? const Color(0xFFF59E0B)
                                : shift.latestWorkLogStatus == 'rejected'
                                    ? const Color(0xFFEF4444)
                                    : Colors.grey,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.assignment_turned_in, size: 12, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            '${shift.workLogs.first.calculatedHours}h',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (isToday)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: shiftColor, borderRadius: BorderRadius.circular(12)),
                      child: const Text('TODAY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.access_time_rounded, size: 18, color: Colors.grey[500]),
                      const SizedBox(width: 8),
                      Text('${shift.startTime} - ${shift.endTime}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.business_rounded, size: 18, color: Colors.grey[500]),
                      const SizedBox(width: 8),
                      Expanded(child: Text(shift.projectName, style: TextStyle(fontSize: 14, color: Colors.grey[700]))),
                    ],
                  ),
                  if (shift.fullAddress.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.location_on_rounded, size: 18, color: Colors.grey[500]),
                        const SizedBox(width: 8),
                        Expanded(child: Text(shift.fullAddress, style: TextStyle(fontSize: 13, color: Colors.grey[600]))),
                      ],
                    ),
                  ],
                  if (shift.supervisorName != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.person_rounded, size: 18, color: Colors.grey[500]),
                        const SizedBox(width: 8),
                        Text('Supervisor: ${shift.supervisorName}', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                      ],
                    ),
                  ],
                  if (shift.notes.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.info_outline_rounded, size: 16, color: Colors.amber),
                          const SizedBox(width: 8),
                          Expanded(child: Text(shift.notes, style: TextStyle(fontSize: 13, color: Colors.amber[800]))),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (shift.canEdit)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: ElevatedButton.icon(
                  onPressed: () => _openWorkLog(shift),
                  icon: const Icon(Icons.edit_note_rounded, size: 20),
                  label: const Text('Fill Work Log'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: shiftColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showShiftDetails(AssignedShift shift) {
    final dateFormat = DateFormat('EEEE, MMMM d, yyyy');
    Color shiftColor;
    try {
      shiftColor = Color(int.parse(shift.shiftColor.replaceFirst('#', '0xFF')));
    } catch (_) {
      shiftColor = const Color(0xFF10B981);
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(margin: const EdgeInsets.only(top: 12), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: shiftColor.withValues(alpha: 0.1)),
              child: Row(
                children: [
                  Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: shiftColor, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.calendar_today_rounded, color: Colors.white, size: 24)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(shift.shiftName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                        Text(dateFormat.format(shift.date), style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _detailRow(Icons.access_time_rounded, 'Time', '${shift.startTime} - ${shift.endTime}'),
                    _detailRow(Icons.business_rounded, 'Project', shift.projectName),
                    if (shift.fullAddress.isNotEmpty) _detailRow(Icons.location_on_rounded, 'Location', shift.fullAddress),
                    if (shift.supervisorName != null) _detailRow(Icons.person_rounded, 'Supervisor', shift.supervisorName!),
                    if (shift.notes.isNotEmpty) _detailRow(Icons.notes_rounded, 'Requirements', shift.notes),
                    const SizedBox(height: 24),
                    if (shift.canEdit)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () { Navigator.pop(context); _openWorkLog(shift); },
                          icon: const Icon(Icons.edit_note_rounded),
                          label: const Text('Fill Work Log'),
                          style: ElevatedButton.styleFrom(backgroundColor: shiftColor, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        ),
                      )
                    else if (!shift.isToday)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: Colors.blue),
                            const SizedBox(width: 12),
                            Expanded(child: Text(shift.date.isAfter(DateTime.now()) ? 'You can fill the work log on the day of the shift.' : 'This shift has been completed.', style: const TextStyle(color: Colors.blue))),
                          ],
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

  Widget _detailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Colors.grey[500]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[500], fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 15, color: Color(0xFF1E293B), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openWorkLog(AssignedShift shift) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Opening work log for ${shift.projectName}...'), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
    );
    // TODO: Navigate to WorkLog add screen with pre-filled project info
  }
}
