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
    return WorkLogModel(
      id: json['id']?.toString() ?? '',
      locationAddress: json['location_address'] ?? json['location_override'] ?? json['project']?['address'] ?? '',
      locationCity: json['location_city'] ?? json['project']?['city'] ?? '',
      date: DateTime.tryParse(json['work_date'] ?? json['date'] ?? '') ?? DateTime.now(),
      startTime: json['start_time']?.toString().substring(0, 5) ?? '',
      endTime: json['end_time']?.toString().substring(0, 5) ?? '',
      breakMinutes: int.tryParse(json['break_duration_minutes']?.toString() ?? json['break_minutes']?.toString() ?? '0') ?? 0,
      hoursWorked: double.tryParse(json['calculated_hours']?.toString() ?? json['hours_worked']?.toString() ?? '0') ?? 0,
      status: json['status'] ?? 'draft',
      notes: json['notes'],
      rejectionReason: json['rejection_reason'],
      allowances: (json['allowances'] as List?)?.cast<Map<String, dynamic>>() ?? [],
      earnings: json['estimated_earnings'] != null 
          ? WorkLogEarnings.fromJson(json['estimated_earnings']) 
          : null,
      projectName: json['project_name'] ?? json['project']?['name'],
      customerName: json['customer_name'] ?? json['project']?['customer_name'],
      supervisorName: json['supervisor_name'] ?? json['supervisor']?['full_name'],
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
    final allowancesList = (json['allowances'] as List? ?? [])
        .map((a) => AllowanceEarning.fromJson(a))
        .toList();
    
    return WorkLogEarnings(
      baseHours: (json['base_hours'] ?? 0).toDouble(),
      baseRate: (json['base_rate'] ?? 0).toDouble(),
      baseAmount: (json['base_amount'] ?? 0).toDouble(),
      allowances: allowancesList,
      allowancesAmount: (json['allowances_amount'] ?? 0).toDouble(),
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
    final body = <String, dynamic>{
      'shift_assignment': assignmentId,
      'work_date': date.toIso8601String().split('T')[0],
      'start_time': startTime,
      'end_time': endTime,
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
    
    final response = await _api.post('/worklogs/', body: body);
    final workLog = WorkLogModel.fromJson(response);
    
    // Upload photos if any
    if (photoPaths != null && photoPaths.isNotEmpty) {
      for (final path in photoPaths) {
        await uploadPhoto(workLog.id, path);
      }
    }
    
    return workLog;
  }

  /// Upload a photo to a work log
  Future<void> uploadPhoto(String workLogId, String filePath) async {
    await _api.uploadFile(
      '/worklogs/$workLogId/add_photo/',
      file: File(filePath),
      fieldName: 'photo',
    );
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

