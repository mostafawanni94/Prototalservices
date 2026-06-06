/**
 * API Configuration for Pro Totaal Service Frontend
 * 
 * This module provides centralized API configuration for consistent
 * communication with the Django backend.
 */

// Base API URL - uses environment variable or defaults to localhost
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Build a full API URL with the given endpoint
 * @param endpoint - The API endpoint (e.g., '/employees/profiles/')
 * @returns The full API URL
 */
export function apiUrl(endpoint: string): string {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${normalizedEndpoint}`;
}

/**
 * Get authorization headers with the current access token
 * @returns Headers object with Authorization
 */
export function getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined'
        ? (localStorage.getItem('access_token') || localStorage.getItem('accessToken'))
        : null;
    return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
    };
}

/**
 * Make an authenticated API request
 * @param endpoint - The API endpoint
 * @param options - Fetch options
 * @returns Promise with the fetch response
 */
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = apiUrl(endpoint);
    const headers = {
        ...getAuthHeaders(),
        ...options.headers,
    };

    return fetch(url, {
        ...options,
        headers,
    });
}

/**
 * API endpoints for the application
 */
export const API_ENDPOINTS = {
    // Auth
    AUTH: {
        TOKEN: '/auth/token/',
        REFRESH: '/auth/token/refresh/',
        VERIFY: '/auth/token/verify/',
        PASSWORD_CHANGE: '/auth/password-change/',
    },

    // Employees
    EMPLOYEES: {
        PROFILES: '/employees/profiles/',
        CONTRACT_TYPES: '/employees/contract-types/',
        AGENCIES: '/employees/agencies/',
        PENDING_APPROVAL: '/employees/pending-approval/',
    },

    // Other modules
    CUSTOMERS: '/customers/',
    PROJECTS: '/projects/',
    WORKLOGS: '/worklogs/',
    INVOICES: '/invoices/',
    WALLET: '/wallet/',
    CERTIFICATES: '/certificates/',
    NOTIFICATIONS: '/notifications/',
};
