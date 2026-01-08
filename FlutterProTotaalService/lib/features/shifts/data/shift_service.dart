/// Shift Service - API Integration
/// 
/// Handles all shift-related API calls.

import '../../../core/network/api_client.dart';

/// Shift model
class Shift {
  final String id;
  final String employeeId;
  final String employeeName;
  final String projectId;
  final String projectName;
  final String? customerName;
  final String? supervisorId;
  final String? supervisorName;
  final String? serviceId;
  final String? serviceName;
  final DateTime scheduledDate;
  final String? scheduledStartTime;
  final String? scheduledEndTime;
  final String? locationNotes;
  final String? supervisorPhone;
  final String? supervisorEmail;
  final String? specialInstructions;
  final String status;
  final String statusDisplay;
  final String? actualStartTime;
  final String? actualEndTime;
  final String? breakStartTime;
  final String? breakEndTime;
  final String? employeeNotes;
  final String? rejectionReason;
  final bool isToday;
  final bool canFillData;
  final bool isPast;
  final bool isFuture;

  Shift({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    required this.projectId,
    required this.projectName,
    this.customerName,
    this.supervisorId,
    this.supervisorName,
    this.serviceId,
    this.serviceName,
    required this.scheduledDate,
    this.scheduledStartTime,
    this.scheduledEndTime,
    this.locationNotes,
    this.supervisorPhone,
    this.supervisorEmail,
    this.specialInstructions,
    required this.status,
    required this.statusDisplay,
    this.actualStartTime,
    this.actualEndTime,
    this.breakStartTime,
    this.breakEndTime,
    this.employeeNotes,
    this.rejectionReason,
    required this.isToday,
    required this.canFillData,
    required this.isPast,
    required this.isFuture,
  });

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: json['id']?.toString() ?? '',
      employeeId: json['employee']?.toString() ?? '',
      employeeName: json['employee_name'] ?? '',
      projectId: json['project']?.toString() ?? '',
      projectName: json['project_name'] ?? '',
      customerName: json['customer_name'],
      supervisorId: json['supervisor']?.toString(),
      supervisorName: json['supervisor_name'],
      serviceId: json['service']?.toString(),
      serviceName: json['service_name'],
      scheduledDate: DateTime.parse(json['scheduled_date']),
      scheduledStartTime: json['scheduled_start_time'],
      scheduledEndTime: json['scheduled_end_time'],
      locationNotes: json['location_notes'],
      supervisorPhone: json['supervisor_phone'],
      supervisorEmail: json['supervisor_email'],
      specialInstructions: json['special_instructions'],
      status: json['status'] ?? 'scheduled',
      statusDisplay: json['status_display'] ?? 'Scheduled',
      actualStartTime: json['actual_start_time'],
      actualEndTime: json['actual_end_time'],
      breakStartTime: json['break_start_time'],
      breakEndTime: json['break_end_time'],
      employeeNotes: json['employee_notes'],
      rejectionReason: json['rejection_reason'],
      isToday: json['is_today'] ?? false,
      canFillData: json['can_fill_data'] ?? false,
      isPast: json['is_past'] ?? false,
      isFuture: json['is_future'] ?? false,
    );
  }

  /// Check if shift has actual times filled
  bool get hasActualTimes => actualStartTime != null && actualEndTime != null;
  
  /// Get status color
  int get statusColor {
    switch (status) {
      case 'scheduled': return 0xFF2563EB; // Blue
      case 'acknowledged': return 0xFF7C3AED; // Purple
      case 'in_progress': return 0xFFF59E0B; // Amber
      case 'submitted': return 0xFFF97316; // Orange
      case 'approved': return 0xFF10B981; // Green
      case 'rejected': return 0xFFEF4444; // Red
      case 'missed': return 0xFF6B7280; // Gray
      case 'cancelled': return 0xFF6B7280; // Gray
      default: return 0xFF6B7280;
    }
  }
}

/// Shift Service
class ShiftService {
  final ApiClient _apiClient;

  ShiftService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Get employee's upcoming shifts
  Future<List<Shift>> getMyShifts() async {
    final response = await _apiClient.get('/worklogs/shifts/my_shifts/');
    final List<dynamic> data = response is List ? response : (response['results'] ?? []);
    return data.map((json) => Shift.fromJson(json)).toList();
  }

  /// Get single shift details
  Future<Shift> getShift(String id) async {
    final response = await _apiClient.get('/worklogs/shifts/$id/');
    return Shift.fromJson(response);
  }

  /// Acknowledge shift (mark as seen)
  Future<Shift> acknowledgeShift(String id) async {
    final response = await _apiClient.post('/worklogs/shifts/$id/acknowledge/');
    return Shift.fromJson(response);
  }

  /// Fill shift data (employee fills actual times)
  Future<Shift> fillShiftData(String id, {
    required String startTime,
    required String endTime,
    String? breakStartTime,
    String? breakEndTime,
    String? notes,
  }) async {
    final response = await _apiClient.post('/worklogs/shifts/$id/fill_data/', body: {
      'start_time': startTime,
      'end_time': endTime,
      if (breakStartTime != null) 'break_start_time': breakStartTime,
      if (breakEndTime != null) 'break_end_time': breakEndTime,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return Shift.fromJson(response);
  }

  /// Submit shift for approval
  Future<Shift> submitShift(String id) async {
    final response = await _apiClient.post('/worklogs/shifts/$id/submit/');
    return Shift.fromJson(response);
  }

  /// Get my assigned shifts (from planning system)
  /// 
  /// Returns only today + future, hides submitted/completed shifts.
  /// Supports pagination with page and pageSize params.
  Future<AssignedShiftsResponse> getMyAssignments({
    String? startDate,
    String? endDate,
    int page = 1,
    int pageSize = 20,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'page_size': pageSize.toString(),
    };
    if (startDate != null) params['start_date'] = startDate;
    if (endDate != null) params['end_date'] = endDate;
    
    final queryString = '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}';
    
    final response = await _apiClient.get('/projects/shift-assignments/my/$queryString');
    
    if (response is Map<String, dynamic>) {
      return AssignedShiftsResponse.fromJson(response);
    }
    
    // Fallback for legacy list response
    if (response is List) {
      return AssignedShiftsResponse(
        results: response.map((json) => AssignedShift.fromJson(json)).toList(),
        count: response.length,
        page: 1,
        pageSize: response.length,
        hasMore: false,
      );
    }
    
    return AssignedShiftsResponse.empty();
  }
}

/// Paginated response for assigned shifts
class AssignedShiftsResponse {
  final List<AssignedShift> results;
  final int count;
  final int page;
  final int pageSize;
  final bool hasMore;

  AssignedShiftsResponse({
    required this.results,
    required this.count,
    required this.page,
    required this.pageSize,
    required this.hasMore,
  });

  factory AssignedShiftsResponse.fromJson(Map<String, dynamic> json) {
    final resultsList = json['results'] as List? ?? [];
    return AssignedShiftsResponse(
      results: resultsList.map((item) => AssignedShift.fromJson(item)).toList(),
      count: json['count'] ?? 0,
      page: json['page'] ?? 1,
      pageSize: json['page_size'] ?? 20,
      hasMore: json['has_more'] ?? false,
    );
  }

  factory AssignedShiftsResponse.empty() {
    return AssignedShiftsResponse(
      results: [],
      count: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    );
  }
}

/// Assigned shift from planning system
class AssignedShift {
  final String id;
  final String status;
  final DateTime date;
  final String shiftName;
  final String shiftColor;
  final String startTime;
  final String endTime;
  final String projectId;
  final String projectName;
  final String projectLocation;
  final String projectAddress;
  final String projectCity;
  final String projectDescription;
  final String customerName;
  final String? supervisorName;
  final String? supervisorPhone;
  final String? supervisorEmail;
  final String notes;
  final bool isToday;
  final bool isPast;
  final bool canEdit;
  final List<AssignedShiftWorkLog> workLogs;

  AssignedShift({
    required this.id,
    required this.status,
    required this.date,
    required this.shiftName,
    required this.shiftColor,
    required this.startTime,
    required this.endTime,
    required this.projectId,
    required this.projectName,
    required this.projectLocation,
    required this.projectAddress,
    required this.projectCity,
    required this.projectDescription,
    required this.customerName,
    this.supervisorName,
    this.supervisorPhone,
    this.supervisorEmail,
    required this.notes,
    required this.isToday,
    required this.isPast,
    required this.canEdit,
    required this.workLogs,
  });

  factory AssignedShift.fromJson(Map<String, dynamic> json) {
    final workLogsJson = json['work_logs'] as List? ?? [];
    return AssignedShift(
      id: json['id'] ?? '',
      status: json['status'] ?? 'planned',
      date: DateTime.parse(json['date']),
      shiftName: json['shift_name'] ?? '',
      shiftColor: json['shift_color'] ?? '#10B981',
      startTime: json['start_time'] ?? '',
      endTime: json['end_time'] ?? '',
      projectId: json['project_id'] ?? '',
      projectName: json['project_name'] ?? '',
      projectLocation: json['project_location'] ?? '',
      projectAddress: json['project_address'] ?? '',
      projectCity: json['project_city'] ?? '',
      projectDescription: json['project_description'] ?? '',
      customerName: json['customer_name'] ?? '',
      supervisorName: json['supervisor_name'],
      supervisorPhone: json['supervisor_phone'],
      supervisorEmail: json['supervisor_email'],
      notes: json['notes'] ?? '',
      isToday: json['is_today'] ?? false,
      isPast: json['is_past'] ?? false,
      canEdit: json['can_edit'] ?? false,
      workLogs: workLogsJson.map((wl) => AssignedShiftWorkLog.fromJson(wl)).toList(),
    );
  }
  
  /// Get full address string
  String get fullAddress {
    final parts = [projectLocation, projectAddress, projectCity]
        .where((p) => p.isNotEmpty)
        .toList();
    return parts.join(', ');
  }
  
  /// Check if this shift has a submitted/approved work log
  bool get hasWorkLog => workLogs.isNotEmpty;
  
  /// Get the latest work log status
  String? get latestWorkLogStatus => workLogs.isNotEmpty ? workLogs.first.status : null;
}

/// Work log attached to an assigned shift
class AssignedShiftWorkLog {
  final String id;
  final String status;
  final String calculatedHours;
  final String? workDate;

  AssignedShiftWorkLog({
    required this.id,
    required this.status,
    required this.calculatedHours,
    this.workDate,
  });

  factory AssignedShiftWorkLog.fromJson(Map<String, dynamic> json) {
    return AssignedShiftWorkLog(
      id: json['id'] ?? '',
      status: json['status'] ?? '',
      calculatedHours: json['calculated_hours'] ?? '0.00',
      workDate: json['work_date'],
    );
  }
}
