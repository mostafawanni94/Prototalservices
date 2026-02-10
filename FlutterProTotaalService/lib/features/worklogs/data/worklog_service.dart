/// Work Log Service - API calls for work logging
/// 
/// Handles work log submission and retrieval.

import 'dart:io';
import '../../../core/network/api_client.dart';

/// Work Log Allowance Model
class WorkLogAllowanceModel {
  final int? allowanceTypeId;
  final String? customName;
  final double hours;
  final String? notes;

  WorkLogAllowanceModel({
    this.allowanceTypeId,
    this.customName,
    required this.hours,
    this.notes,
  });

  Map<String, dynamic> toJson() {
    return {
      'allowance_type': allowanceTypeId,
      'custom_allowance_name': customName ?? '',
      'hours': hours,
      'notes': notes ?? '',
    };
  }
}

/// Allowance Type Model (for dropdown)
class AllowanceTypeModel {
  final int id;
  final String name;
  final String code;
  final double basePrice;

  AllowanceTypeModel({
    required this.id,
    required this.name,
    required this.code,
    required this.basePrice,
  });

  factory AllowanceTypeModel.fromJson(Map<String, dynamic> json) {
    return AllowanceTypeModel(
      id: int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      basePrice: double.tryParse(json['base_price']?.toString() ?? '0') ?? 0,
    );
  }
}

/// Work Log Model
class WorkLogModel {
  final String id;
  final String locationAddress;
  final String locationCity;
  final DateTime date;
  final String startTime;
  final String endTime;
  final int breakMinutes;
  final double hoursWorked;
  final String status;
  final String? notes;
  final String? rejectionReason;
  final List<Map<String, dynamic>> allowances;
  final WorkLogEarnings? earnings;
  final String? projectName;
  final String? customerName;
  final String? supervisorName;

  WorkLogModel({
    required this.id,
    required this.locationAddress,
    required this.locationCity,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.breakMinutes,
    required this.hoursWorked,
    required this.status,
    this.notes,
    this.rejectionReason,
    this.allowances = const [],
    this.earnings,
    this.projectName,
    this.customerName,
    this.supervisorName,
  });

  factory WorkLogModel.fromJson(Map<String, dynamic> json) {
    // Helper to safely extract time string
    String safeTimeString(dynamic value) {
      if (value == null) return '';
      final str = value.toString();
      if (str.length >= 5) return str.substring(0, 5);
      return str;
    }
    
    // Safely parse allowances - could be a List or null
    List<Map<String, dynamic>> parseAllowances(dynamic value) {
      if (value == null) return [];
      if (value is List) {
        return value.whereType<Map<String, dynamic>>().toList();
      }
      return [];
    }
    
    // Safely get nested value - handles both objects and UUIDs
    String? safeNestedString(dynamic obj, String key) {
      if (obj == null) return null;
      if (obj is Map<String, dynamic>) return obj[key]?.toString();
      return null;
    }
    
    return WorkLogModel(
      id: json['id']?.toString() ?? '',
      locationAddress: json['location_address'] ?? json['location_override'] ?? safeNestedString(json['project'], 'address') ?? '',
      locationCity: json['location_city'] ?? safeNestedString(json['project'], 'city') ?? '',
      date: DateTime.tryParse(json['work_date'] ?? json['date'] ?? '') ?? DateTime.now(),
      startTime: safeTimeString(json['start_time'] ?? json['actual_start_datetime']),
      endTime: safeTimeString(json['end_time'] ?? json['actual_end_datetime']),
      breakMinutes: int.tryParse(json['break_duration_minutes']?.toString() ?? json['break_minutes']?.toString() ?? '0') ?? 0,
      hoursWorked: double.tryParse(json['calculated_hours']?.toString() ?? json['hours_worked']?.toString() ?? '0') ?? 0,
      status: json['status'] ?? 'draft',
      notes: json['notes'],
      rejectionReason: json['rejection_reason'],
      allowances: parseAllowances(json['allowances']),
      // Use surcharges_breakdown from API (includes base, surcharges, and allowances)
      earnings: json['surcharges_breakdown'] != null 
          ? WorkLogEarnings.fromJson(json['surcharges_breakdown']) 
          : null,
      projectName: json['project_name'] ?? safeNestedString(json['project'], 'name'),
      customerName: json['customer_name'] ?? safeNestedString(json['project'], 'customer_name'),
      supervisorName: json['supervisor_name'] ?? safeNestedString(json['supervisor'], 'full_name'),
    );
  }

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending' || status == 'submitted';
  bool get isRejected => status == 'rejected';
  bool get isDraft => status == 'draft';
}

/// Earnings breakdown for a work log
class WorkLogEarnings {
  final double baseHours;
  final double baseRate;
  final double baseAmount;
  final List<AllowanceEarning> allowances;
  final double allowancesAmount;
  final double total;

  WorkLogEarnings({
    required this.baseHours,
    required this.baseRate,
    required this.baseAmount,
    required this.allowances,
    required this.allowancesAmount,
    required this.total,
  });

  factory WorkLogEarnings.fromJson(Map<String, dynamic> json) {
    // Parse breakdown array from surcharges_breakdown
    final breakdownList = (json['breakdown'] as List? ?? [])
        .map((a) => AllowanceEarning.fromJson(a))
        .toList();
    
    return WorkLogEarnings(
      baseHours: (json['normal_hours'] ?? json['base_hours'] ?? 0).toDouble(),
      baseRate: (json['base_rate'] ?? 0).toDouble(),
      baseAmount: (json['base_amount'] ?? 0).toDouble(),
      allowances: breakdownList,  // Surcharge breakdown items
      allowancesAmount: (json['total_allowances_amount'] ?? json['allowances_amount'] ?? 0).toDouble(),
      total: (json['total'] ?? 0).toDouble(),
    );
  }
}

/// Single allowance earning entry
class AllowanceEarning {
  final String name;
  final double hours;
  final double rate;
  final double amount;

  AllowanceEarning({
    required this.name,
    required this.hours,
    required this.rate,
    required this.amount,
  });

  factory AllowanceEarning.fromJson(Map<String, dynamic> json) {
    return AllowanceEarning(
      name: json['name'] ?? '',
      hours: (json['hours'] ?? 0).toDouble(),
      rate: (json['rate'] ?? 0).toDouble(),
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }
}

/// Work Log Service
class WorkLogService {
  final ApiClient _api;

  WorkLogService({ApiClient? api}) : _api = api ?? ApiClient();

  /// Get allowance types
  Future<List<AllowanceTypeModel>> getAllowanceTypes() async {
    final response = await _api.get('/employees/allowance-types/');
    final results = response['results'] as List? ?? response as List? ?? [];
    return results.map((a) => AllowanceTypeModel.fromJson(a)).toList();
  }

  /// Get my work logs
  Future<List<WorkLogModel>> getMyWorkLogs({String? status, int? week, int? year}) async {
    String url = '/worklogs/?employee=me';
    if (status != null) url += '&status=$status';
    if (week != null) url += '&billing_week_number=$week';
    if (year != null) url += '&billing_week_year=$year';
    
    final response = await _api.get(url);
    final results = response['results'] as List? ?? [];
    return results.map((w) => WorkLogModel.fromJson(w)).toList();
  }

  /// Submit new work log with optional allowances, breaks, and photos
  /// 
  /// If assignmentId is a work entry ID, we PATCH to update it with actual times.
  /// The backend WorkEntry uses actual_start_datetime/actual_end_datetime.
  Future<WorkLogModel> submitWorkLog({
    required String assignmentId,
    required DateTime date,
    required String startTime,
    required String endTime,
    int? breakMinutes,
    List<Map<String, String>>? breaks,
    String? notes,
    List<WorkLogAllowanceModel>? allowances,
    List<String>? photoPaths,
  }) async {
    // Build datetime strings from date and time with timezone offset
    // We must include the local timezone offset so Django doesn't treat
    // the datetime as UTC (which causes a +1h shift for Europe/Amsterdam)
    final now = DateTime.now();
    final offset = now.timeZoneOffset;
    final sign = offset.isNegative ? '-' : '+';
    final hours = offset.inHours.abs().toString().padLeft(2, '0');
    final minutes = (offset.inMinutes.abs() % 60).toString().padLeft(2, '0');
    final tzSuffix = '$sign$hours:$minutes'; // e.g. "+01:00" or "+02:00"
    
    final dateStr = date.toIso8601String().split('T')[0];
    final startDateTime = '${dateStr}T$startTime:00$tzSuffix';
    final endDateTime = '${dateStr}T$endTime:00$tzSuffix';
    
    final body = <String, dynamic>{
      'actual_start_datetime': startDateTime,
      'actual_end_datetime': endDateTime,
      'work_date': date.toIso8601String().split('T')[0],
      'status': 'pending',  // Set to pending when submitting
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    };
    
    // Send breaks array if provided
    if (breaks != null && breaks.isNotEmpty) {
      body['breaks'] = breaks;
    } else if (breakMinutes != null) {
      body['break_duration_minutes'] = breakMinutes;
    }
    
    if (allowances != null && allowances.isNotEmpty) {
      body['allowances'] = allowances.map((a) => a.toJson()).toList();
    }
    
    // PATCH the existing work entry to update with actual times
    final response = await _api.patch('/worklogs/entries/$assignmentId/', body: body);
    final workLog = WorkLogModel.fromJson(response);
    
    // TODO: Photo upload not yet implemented on backend
    // Upload photos if any - use assignmentId directly since that's our entry ID
    // if (photoPaths != null && photoPaths.isNotEmpty) {
    //   for (final path in photoPaths) {
    //     await uploadPhoto(assignmentId, path);
    //   }
    // }
    
    return workLog;
  }

  /// Upload a photo to a work entry
  /// Note: Backend endpoint not yet implemented
  Future<void> uploadPhoto(String entryId, String filePath) async {
    // TODO: Implement when backend add_photo endpoint is ready
    // await _api.uploadFile(
    //   '/worklogs/entries/$entryId/add_photo/',
    //   file: File(filePath),
    //   fieldName: 'photo',
    // );
  }

  /// Update rejected work log
  Future<WorkLogModel> updateWorkLog(String id, Map<String, dynamic> data) async {
    final response = await _api.patch('/worklogs/$id/', body: data);
    return WorkLogModel.fromJson(response);
  }

  /// Submit work log for approval
  Future<WorkLogModel> submitForApproval(String id) async {
    final response = await _api.post('/worklogs/$id/submit/');
    return WorkLogModel.fromJson(response);
  }
}

