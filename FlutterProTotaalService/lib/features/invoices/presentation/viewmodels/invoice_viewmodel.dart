/// Invoice ViewModel - MVVM Pattern
/// 
/// Handles invoice and work log state with filtering and per-tab pagination.

import 'package:flutter/foundation.dart';
import '../../data/invoice_service.dart';

/// Filter options
enum WorkLogFilter { all, pending, approved, rejected, draft }
enum DateFilter { thisWeek, lastWeek, thisMonth, custom }

/// Pagination state for a single tab
class TabPaginationState {
  List<WorkLogModel> items = [];
  bool isLoading = false;
  bool isLoadingMore = false;
  bool hasMore = true;
  int currentPage = 1;
  
  void reset() {
    items = [];
    isLoading = false;
    isLoadingMore = false;
    hasMore = true;
    currentPage = 1;
  }
}

class InvoiceViewModel extends ChangeNotifier {
  final InvoiceService _service;

  // Separate pagination state for each tab
  final Map<WorkLogFilter, TabPaginationState> _tabStates = {
    WorkLogFilter.all: TabPaginationState(),
    WorkLogFilter.pending: TabPaginationState(),
    WorkLogFilter.approved: TabPaginationState(),
    WorkLogFilter.rejected: TabPaginationState(),
  };
  
  List<EmployeeInvoiceModel> _invoices = [];
  Map<String, dynamic>? _pendingEarnings;
  
  String? _error;
  
  WorkLogFilter _workLogFilter = WorkLogFilter.all;
  DateFilter _dateFilter = DateFilter.thisWeek;
  DateTime? _customStartDate;
  DateTime? _customEndDate;
  int? _selectedWeekYear;
  int? _selectedWeekNumber;

  InvoiceViewModel({InvoiceService? service})
      : _service = service ?? InvoiceService();

  // Current tab state getters
  TabPaginationState get _currentTabState => _tabStates[_workLogFilter]!;
  
  List<WorkLogModel> get workLogs => _currentTabState.items;
  List<WorkLogModel> get allWorkLogs => _tabStates[WorkLogFilter.all]!.items;
  List<WorkLogModel> get filteredWorkLogs => _currentTabState.items;
  
  List<EmployeeInvoiceModel> get invoices => _invoices;
  Map<String, dynamic>? get pendingEarnings => _pendingEarnings;
  
  bool get isLoading => _currentTabState.isLoading;
  bool get isLoadingMore => _currentTabState.isLoadingMore;
  bool get hasMore => _currentTabState.hasMore;
  
  String? get error => _error;
  WorkLogFilter get workLogFilter => _workLogFilter;
  DateFilter get dateFilter => _dateFilter;

  List<EmployeeInvoiceModel> get paidInvoices =>
      _invoices.where((i) => i.isPaid).toList();

  List<EmployeeInvoiceModel> get pendingInvoices =>
      _invoices.where((i) => i.isPending || i.isSent).toList();

  double get totalApprovedEarnings {
    return _tabStates[WorkLogFilter.approved]!.items
        .fold(0.0, (sum, w) => sum + (w.estimatedEarnings ?? 0));
  }

  double get totalPendingEarnings {
    return _tabStates[WorkLogFilter.pending]!.items
        .fold(0.0, (sum, w) => sum + (w.estimatedEarnings ?? 0));
  }

  int get pendingCount => _tabStates[WorkLogFilter.pending]!.items.length;

  double get totalApprovedHours {
    return _tabStates[WorkLogFilter.approved]!.items
        .fold(0.0, (sum, w) => sum + w.billableHours);
  }

  /// Get status string for API from filter
  String? _getStatusFromFilter(WorkLogFilter filter) {
    switch (filter) {
      case WorkLogFilter.pending:
        return 'submitted'; // Backend uses 'submitted' for pending
      case WorkLogFilter.approved:
        return 'approved';
      case WorkLogFilter.rejected:
        return 'rejected';
      case WorkLogFilter.draft:
        return 'draft';
      case WorkLogFilter.all:
      default:
        return null; // No filter for 'all'
    }
  }

  /// Set work log filter and load data for that tab if not already loaded
  void setWorkLogFilter(WorkLogFilter filter) {
    _workLogFilter = filter;
    notifyListeners();
    
    // Load data for this tab if it's empty
    if (_currentTabState.items.isEmpty && !_currentTabState.isLoading) {
      loadWorkLogs();
    }
  }

  /// Set date filter
  void setDateFilter(DateFilter filter, {DateTime? start, DateTime? end}) {
    _dateFilter = filter;
    _customStartDate = start;
    _customEndDate = end;
    // Reset all tabs and reload current
    for (var state in _tabStates.values) {
      state.reset();
    }
    loadWorkLogs();
  }

  /// Set week filter
  void setWeekFilter(int year, int week) {
    _selectedWeekYear = year;
    _selectedWeekNumber = week;
    for (var state in _tabStates.values) {
      state.reset();
    }
    loadWorkLogs();
  }

  /// Clear week filter
  void clearWeekFilter() {
    _selectedWeekYear = null;
    _selectedWeekNumber = null;
    for (var state in _tabStates.values) {
      state.reset();
    }
    loadWorkLogs();
  }

  /// Load work logs for current tab (first page)
  Future<void> loadWorkLogs() async {
    final tabState = _currentTabState;
    
    tabState.isLoading = true;
    tabState.currentPage = 1;
    tabState.hasMore = true;
    tabState.items = [];
    _error = null;
    notifyListeners();

    try {
      DateTime? startDate;
      DateTime? endDate;
      
      // Calculate date range based on filter
      final now = DateTime.now();
      switch (_dateFilter) {
        case DateFilter.thisWeek:
          startDate = now.subtract(Duration(days: now.weekday - 1));
          endDate = startDate.add(const Duration(days: 6));
          break;
        case DateFilter.lastWeek:
          startDate = now.subtract(Duration(days: now.weekday + 6));
          endDate = startDate.add(const Duration(days: 6));
          break;
        case DateFilter.thisMonth:
          startDate = DateTime(now.year, now.month, 1);
          endDate = DateTime(now.year, now.month + 1, 0);
          break;
        case DateFilter.custom:
          startDate = _customStartDate;
          endDate = _customEndDate;
          break;
      }

      final result = await _service.getMyWorkLogs(
        weekYear: _selectedWeekYear,
        weekNumber: _selectedWeekNumber,
        status: _getStatusFromFilter(_workLogFilter),
        startDate: startDate,
        endDate: endDate,
        page: tabState.currentPage,
      );
      
      tabState.items = result.results;
      tabState.hasMore = result.hasMore;
      if (result.nextPage != null) {
        tabState.currentPage = result.nextPage!;
      }
      
      tabState.isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      tabState.isLoading = false;
      notifyListeners();
    }
  }

  /// Load more work logs for current tab (pagination)
  Future<void> loadMoreWorkLogs() async {
    final tabState = _currentTabState;
    
    if (tabState.isLoadingMore || !tabState.hasMore) return;
    
    tabState.isLoadingMore = true;
    notifyListeners();

    try {
      DateTime? startDate;
      DateTime? endDate;
      
      // Calculate date range based on filter
      final now = DateTime.now();
      switch (_dateFilter) {
        case DateFilter.thisWeek:
          startDate = now.subtract(Duration(days: now.weekday - 1));
          endDate = startDate.add(const Duration(days: 6));
          break;
        case DateFilter.lastWeek:
          startDate = now.subtract(Duration(days: now.weekday + 6));
          endDate = startDate.add(const Duration(days: 6));
          break;
        case DateFilter.thisMonth:
          startDate = DateTime(now.year, now.month, 1);
          endDate = DateTime(now.year, now.month + 1, 0);
          break;
        case DateFilter.custom:
          startDate = _customStartDate;
          endDate = _customEndDate;
          break;
      }

      final result = await _service.getMyWorkLogs(
        weekYear: _selectedWeekYear,
        weekNumber: _selectedWeekNumber,
        status: _getStatusFromFilter(_workLogFilter),
        startDate: startDate,
        endDate: endDate,
        page: tabState.currentPage,
      );
      
      tabState.items.addAll(result.results);
      tabState.hasMore = result.hasMore;
      if (result.nextPage != null) {
        tabState.currentPage = result.nextPage!;
      }
      
      tabState.isLoadingMore = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      tabState.isLoadingMore = false;
      notifyListeners();
    }
  }

  /// Load invoices
  Future<void> loadInvoices() async {
    notifyListeners();

    try {
      _invoices = await _service.getMyInvoices();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Load pending earnings preview
  Future<void> loadPendingEarnings() async {
    try {
      _pendingEarnings = await _service.getPendingEarnings();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Submit work log for approval
  Future<bool> submitWorkLog(String id) async {
    try {
      await _service.submitWorkLog(id);
      // Reset and reload all tabs
      for (var state in _tabStates.values) {
        state.reset();
      }
      await loadWorkLogs();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Update work log (when it was rejected)
  Future<bool> updateWorkLog(String id, Map<String, dynamic> data) async {
    try {
      await _service.updateWorkLog(id, data);
      // Reset and reload all tabs
      for (var state in _tabStates.values) {
        state.reset();
      }
      await loadWorkLogs();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
