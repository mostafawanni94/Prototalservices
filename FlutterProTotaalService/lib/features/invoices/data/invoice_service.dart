/// Invoice Service - API Calls for Employee Invoices
/// 
/// Handles work logs and invoice viewing for employees.

import '../../../core/network/api_client.dart';

/// Work Log Model
class WorkLogModel {
  final String id;
  final String projectName;
  final String customerName;
  final String? supervisorName;
  final String? serviceName;
  final String? location;
  final DateTime workDate;
  final String startTime;
  final String endTime;
  final double calculatedHours;
  final double billableHours;
  final double? estimatedEarnings;
  final String status;
  final String? notes;
  final String? rejectionReason;
  final int billingWeekYear;
  final int billingWeekNumber;
  final DateTime createdAt;

  WorkLogModel({
    required this.id,
    required this.projectName,
    required this.customerName,
    this.supervisorName,
    this.serviceName,
    this.location,
    required this.workDate,
    required this.startTime,
    required this.endTime,
    required this.calculatedHours,
    required this.billableHours,
    this.estimatedEarnings,
    required this.status,
    this.notes,
    this.rejectionReason,
    required this.billingWeekYear,
    required this.billingWeekNumber,
    required this.createdAt,
  });

  factory WorkLogModel.fromJson(Map<String, dynamic> json) {
    return WorkLogModel(
      id: json['id']?.toString() ?? '',
      projectName: json['project_name'] ?? '',
      customerName: json['customer_name'] ?? '',
      supervisorName: json['supervisor_name'],
      serviceName: json['service_name'],
      location: json['location_override'] ?? json['location'],
      workDate: DateTime.tryParse(json['work_date'] ?? '') ?? DateTime.now(),
      startTime: json['start_time'] ?? '',
      endTime: json['end_time'] ?? '',
      calculatedHours: double.tryParse(json['calculated_hours']?.toString() ?? '') ?? 0.0,
      billableHours: double.tryParse(json['billable_hours']?.toString() ?? '') ?? 0.0,
      estimatedEarnings: double.tryParse(json['estimated_earnings']?.toString() ?? ''),
      status: json['status'] ?? 'draft',
      notes: json['notes'],
      rejectionReason: json['rejection_reason'],
      billingWeekYear: int.tryParse(json['billing_week_year']?.toString() ?? '') ?? DateTime.now().year,
      billingWeekNumber: int.tryParse(json['billing_week_number']?.toString() ?? '') ?? 1,
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    );
  }

  bool get isDone => status == 'approved';
  bool get isPending => status == 'submitted' || status == 'pending';
  bool get needsEdit => status == 'rejected';
  bool get isDraft => status == 'draft';
  
  String get weekLabel => 'Week $billingWeekNumber, $billingWeekYear';
  
  String get statusLabel {
    switch (status) {
      case 'approved': return 'Approved';
      case 'submitted': return 'Pending Approval';
      case 'rejected': return 'Needs Edit';
      case 'draft': return 'Draft';
      default: return status;
    }
  }
}

/// Employee Invoice Model
class EmployeeInvoiceModel {
  final String id;
  final String invoiceNumber;
  final int weekYear;
  final int weekNumber;
  final DateTime weekStartDate;
  final DateTime weekEndDate;
  final double totalHours;
  final double hourlyRate;
  final double grossEarnings;
  final double deductions;
  final double netEarnings;
  final String status;
  final List<InvoiceLineModel> lines;
  final DateTime? paidDate;
  final DateTime createdAt;

  EmployeeInvoiceModel({
    required this.id,
    required this.invoiceNumber,
    required this.weekYear,
    required this.weekNumber,
    required this.weekStartDate,
    required this.weekEndDate,
    required this.totalHours,
    required this.hourlyRate,
    required this.grossEarnings,
    required this.deductions,
    required this.netEarnings,
    required this.status,
    required this.lines,
    this.paidDate,
    required this.createdAt,
  });

  factory EmployeeInvoiceModel.fromJson(Map<String, dynamic> json) {
    return EmployeeInvoiceModel(
      id: json['id'],
      invoiceNumber: json['invoice_number'] ?? '',
      weekYear: json['week_year'] ?? DateTime.now().year,
      weekNumber: json['week_number'] ?? 1,
      weekStartDate: DateTime.tryParse(json['week_start_date'] ?? '') ?? DateTime.now(),
      weekEndDate: DateTime.tryParse(json['week_end_date'] ?? '') ?? DateTime.now(),
      totalHours: double.tryParse(json['total_hours'].toString()) ?? 0.0,
      hourlyRate: double.tryParse(json['hourly_rate'].toString()) ?? 0.0,
      grossEarnings: double.tryParse(json['gross_earnings'].toString()) ?? 0.0,
      deductions: double.tryParse(json['deductions'].toString()) ?? 0.0,
      netEarnings: double.tryParse(json['net_earnings'].toString()) ?? 0.0,
      status: json['status'] ?? 'pending',
      lines: (json['lines'] as List? ?? [])
          .map((l) => InvoiceLineModel.fromJson(l))
          .toList(),
      paidDate: json['paid_date'] != null ? DateTime.tryParse(json['paid_date']) : null,
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    );
  }

  bool get isPaid => status == 'paid';
  bool get isPending => status == 'pending' || status == 'draft';
  bool get isSent => status == 'sent';
  
  String get weekLabel => 'Week $weekNumber, $weekYear';
  String get dateRange => '${_formatDate(weekStartDate)} - ${_formatDate(weekEndDate)}';
  
  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}';
  }
}

/// Invoice Line Model
class InvoiceLineModel {
  final String id;
  final String projectName;
  final String description;
  final double hours;
  final double rate;
  final double total;

  InvoiceLineModel({
    required this.id,
    required this.projectName,
    required this.description,
    required this.hours,
    required this.rate,
    required this.total,
  });

  factory InvoiceLineModel.fromJson(Map<String, dynamic> json) {
    return InvoiceLineModel(
      id: json['id'] ?? '',
      projectName: json['project_name'] ?? '',
      description: json['description'] ?? '',
      hours: double.tryParse(json['quantity_hours'].toString()) ?? 0.0,
      rate: double.tryParse(json['hourly_rate'].toString()) ?? 0.0,
      total: double.tryParse(json['total'].toString()) ?? 0.0,
    );
  }
}

/// Invoice Service
class InvoiceService {
  final ApiClient _api;

  InvoiceService({ApiClient? api}) : _api = api ?? ApiClient();

/// Get my work logs with optional filters and pagination
  Future<({List<WorkLogModel> results, bool hasMore, int? nextPage})> getMyWorkLogs({
    int? weekYear,
    int? weekNumber,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
    int page = 1,
    int pageSize = 10,
  }) async {
    String endpoint = '/worklogs/?page=$page&page_size=$pageSize&';
    
    if (weekYear != null) endpoint += 'billing_week_year=$weekYear&';
    if (weekNumber != null) endpoint += 'billing_week_number=$weekNumber&';
    if (status != null) endpoint += 'status=$status&';
    if (startDate != null) endpoint += 'work_date__gte=${startDate.toIso8601String().split('T')[0]}&';
    if (endDate != null) endpoint += 'work_date__lte=${endDate.toIso8601String().split('T')[0]}&';
    
    final response = await _api.get(endpoint);
    final results = (response['results'] as List? ?? [])
        .map((w) => WorkLogModel.fromJson(w))
        .toList();
    
    // Check if there are more pages
    final hasMore = response['next'] != null;
    final nextPage = hasMore ? page + 1 : null;
    
    return (results: results, hasMore: hasMore, nextPage: nextPage);
  }

  /// Get all work logs (for backward compatibility, loads all pages)
  Future<List<WorkLogModel>> getAllWorkLogs({
    int? weekYear,
    int? weekNumber,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    List<WorkLogModel> allLogs = [];
    int page = 1;
    bool hasMore = true;
    
    while (hasMore) {
      final result = await getMyWorkLogs(
        weekYear: weekYear,
        weekNumber: weekNumber,
        status: status,
        startDate: startDate,
        endDate: endDate,
        page: page,
        pageSize: 50,
      );
      allLogs.addAll(result.results);
      hasMore = result.hasMore;
      page++;
    }
    
    return allLogs;
  }

  /// Get my invoices/earnings
  Future<List<EmployeeInvoiceModel>> getMyInvoices({
    int? weekYear,
    String? status,
  }) async {
    String endpoint = '/invoices/my-invoices/?';
    
    if (weekYear != null) endpoint += 'week_year=$weekYear&';
    if (status != null) endpoint += 'status=$status&';
    
    final response = await _api.get(endpoint);
    final results = response['results'] as List? ?? [];
    return results.map((i) => EmployeeInvoiceModel.fromJson(i)).toList();
  }

  /// Get pending earnings (what will be in next invoice)
  Future<Map<String, dynamic>> getPendingEarnings() async {
    return await _api.get('/invoices/pending-earnings/');
  }

  /// Submit work log
  Future<WorkLogModel> submitWorkLog(String id) async {
    final response = await _api.post('/worklogs/$id/submit/');
    return WorkLogModel.fromJson(response);
  }

  /// Update work log (when rejected - needs edit)
  Future<WorkLogModel> updateWorkLog(String id, Map<String, dynamic> data) async {
    final response = await _api.patch('/worklogs/$id/', body: data);
    return WorkLogModel.fromJson(response);
  }
}
